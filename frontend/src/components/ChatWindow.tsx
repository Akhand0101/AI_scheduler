import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  Box,
  TextField,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  IconButton
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";

type Message = { sender: "user" | "bot"; text: string };

// Send sound (pop) - for user messages
const playSendSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Quick pop sound (lower pitch, short)
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.08);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.log("Audio not supported");
  }
};

// Receive sound (WhatsApp-like ting) - for bot messages
const playReceiveSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // First note (lower)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    osc1.frequency.setValueAtTime(830, audioContext.currentTime); // G#5
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.15);

    // Second note (higher) - slight delay for ting effect
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    osc2.frequency.setValueAtTime(1046, audioContext.currentTime + 0.08); // C6
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, audioContext.currentTime);
    gain2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

    osc2.start(audioContext.currentTime + 0.08);
    osc2.stop(audioContext.currentTime + 0.25);
  } catch (e) {
    console.log("Audio not supported");
  }
};

// Legacy function name for backward compatibility
const playPopSound = playReceiveSound;


export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "Hi, I'm Kai. I'm here to support you in finding a therapist. I know reaching out can be a big step. How can I help you today?" }
  ]);
  // Use a random ID per session for demo purposes, ensuring a fresh conversation on refresh
  const [patientId] = useState(`anon-${Math.random().toString(36).substring(7)}`);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const [matchedTherapistId, setMatchedTherapistId] = useState<string | null>(null);
  const [pendingTherapistMatches, setPendingTherapistMatches] = useState<any[] | null>(null);

  const sendToHandleChat = async (text: string, currentMatchedId: string | null) => {
    // Build conversation history from messages
    const conversationHistory = messages.slice(-10).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    const { data, error } = await supabase.functions.invoke('handle-chat', {
      body: {
        userMessage: text,
        patientId: patientId,
        matchedTherapistId: currentMatchedId,
        pendingTherapistMatches: pendingTherapistMatches,
        conversationHistory: conversationHistory
      }
    });

    if (error) {
      console.error("Function error:", error);
      throw new Error(error.message || "Failed to process message");
    }

    return data;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    playSendSound(); // Play pop sound when user sends message
    setLoading(true);

    try {
      const data: any = await sendToHandleChat(userMsg, matchedTherapistId);

      // Use the AI-generated conversational response
      const reply = data?.aiResponse || data?.message || "I processed that, but didn't get a specific response.";

      // Debugging: Log the extracted data to console
      if (data?.extractedData) {
        console.log("AI Extracted:", data.extractedData);
      }

      setMessages(prev => [...prev, { sender: "bot", text: reply }]);
      playPopSound(); // Play pop sound when bot responds

      // --- Handle therapist selection ---
      if (data?.nextAction === 'therapist-selected' && data.therapistId) {
        setMatchedTherapistId(data.therapistId);
        setPendingTherapistMatches(null); // Clear pending matches
        // AI response already included in 'reply' - no need for duplicate message
      }

      // --- Orchestration Logic ---
      if (data?.nextAction === 'find-therapist' && data.inquiryId) {
        setMessages(prev => [...prev, { sender: 'bot', text: "Thank you. I'm looking for therapists who can best support you..." }]);
        playPopSound();

        const { data: findData, error: findError } = await supabase.functions.invoke('find-therapist', {
          body: { inquiryId: data.inquiryId, limit: 3 }
        });

        if (findError) {
          console.error(findError);
          setMessages(prev => [...prev, { sender: 'bot', text: "I encountered an error searching for therapists." }]);
          playPopSound();
        } else if (findData.matches && findData.matches.length > 0) {
          // Store matches for potential selection
          const therapistOptions = findData.matches.map((m: any) => ({
            id: m.therapist.id,
            name: m.therapist.name,
            specialties: m.therapist.specialties,
            accepted_insurance: m.therapist.accepted_insurance,
            bio: m.therapist.bio
          }));
          setPendingTherapistMatches(therapistOptions);

          // Show all matches with details
          let matchesText = "I've found some thoughtful matches for you:\n\n";
          findData.matches.forEach((match: any, index: number) => {
            const t = match.therapist;
            const specialtiesStr = Array.isArray(t.specialties) ? t.specialties.slice(0, 3).join(", ") : "Multiple areas";
            const insuranceStr = Array.isArray(t.accepted_insurance) ? t.accepted_insurance.slice(0, 2).join(", ") : "Various providers";

            matchesText += `${index + 1}. ${t.name}\n`;
            matchesText += `   • Specialties: ${specialtiesStr}\n`;
            matchesText += `   • Accepts: ${insuranceStr}\n`;
            if (t.bio) {
              const shortBio = t.bio.substring(0, 100) + (t.bio.length > 100 ? "..." : "");
              matchesText += `   • About: ${shortBio}\n`;
            }
            matchesText += "\n";
          });

          matchesText += "Does one of these stand out to you? Let me know which one you prefer (e.g., '1' or 'the first one').";

          setMessages(prev => [...prev, {
            sender: 'bot',
            text: matchesText
          }]);
          playPopSound();
        } else {
          setMessages(prev => [...prev, { sender: 'bot', text: "I couldn't find any therapists matching your specific criteria right now. Would you like to adjust your requirements?" }]);
          playPopSound();
        }
      }

      if (data?.nextAction === 'book-appointment' && data.therapistId && data.startTime) {
        setMessages(prev => [...prev, { sender: 'bot', text: "Wonderful. I'm securing that time for you..." }]);
        playPopSound();

        const { data: bookData, error: bookError } = await supabase.functions.invoke('book-appointment', {
          body: {
            inquiryId: data.inquiryId,
            therapistId: data.therapistId,
            startTime: data.startTime,
            endTime: data.endTime,
            patientName: "Guest Patient",
            timeZone: data.timeZone || 'Asia/Kolkata'
          }
        });

        if (bookError) {
          setMessages(prev => [...prev, { sender: 'bot', text: `I had trouble booking that appointment: ${bookError.message}. Could you try a different time?` }]);
          playPopSound();
        } else {
          const appointmentDate = new Date(data.startTime);
          const dateOptions: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          };
          const dateStr = appointmentDate.toLocaleDateString('en-US', dateOptions);

          let confirmMessage = `✅ All set! Your appointment is confirmed for:\n\n${dateStr}\n\n`;

          if (bookData?.googleCalendarError) {
            confirmMessage += `⚠️ Note: The appointment was saved, but there was an issue syncing with the therapist's Google Calendar. They'll still see your appointment in our system.`;
          } else {
            confirmMessage += `📧 A calendar invite has been sent to your therapist. Looking forward to your session!`;
          }

          setMessages(prev => [...prev, { sender: 'bot', text: confirmMessage }]);
          playPopSound();

          // Clear state after successful booking
          setMatchedTherapistId(null);
          setPendingTherapistMatches(null);
        }
      }

    } catch (err: any) {
      setMessages(prev => [...prev, { sender: "bot", text: "I'm having a bit of trouble connecting right now. Could you try that again?" }]);
      playPopSound();
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        maxWidth: 900,
        height: 650,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 4,
        bgcolor: 'background.paper',
        boxShadow: '0px 8px 24px rgba(60, 64, 67, 0.15), 0px 2px 6px rgba(60, 64, 67, 0.1)',
        transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0px 12px 32px rgba(60, 64, 67, 0.2), 0px 4px 8px rgba(60, 64, 67, 0.15)',
        }
      }}
    >
      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)',
          position: 'relative',
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#dadce0',
            borderRadius: '8px',
            '&:hover': {
              backgroundColor: '#bdc1c6',
            },
          },
        }}
      >
        {messages.map((m, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
              alignItems: 'flex-end',
              gap: 1.5,
              animation: 'fadeInUp 0.3s ease-out',
              '@keyframes fadeInUp': {
                from: {
                  opacity: 0,
                  transform: 'translateY(10px)',
                },
                to: {
                  opacity: 1,
                  transform: 'translateY(0)',
                },
              },
            }}
          >
            {m.sender === "bot" && (
              <Avatar
                sx={{
                  background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                  width: 36,
                  height: 36,
                  boxShadow: '0 2px 8px rgba(26, 115, 232, 0.3)',
                }}
              >
                <SmartToyIcon fontSize="small" />
              </Avatar>
            )}

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                maxWidth: '75%',
                borderRadius: 3,
                borderBottomLeftRadius: m.sender === "bot" ? 4 : 3,
                borderBottomRightRadius: m.sender === "user" ? 4 : 3,
                bgcolor: m.sender === "user"
                  ? 'primary.main'
                  : 'white',
                background: m.sender === "user"
                  ? 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)'
                  : 'white',
                color: m.sender === "user" ? 'white' : 'text.primary',
                boxShadow: m.sender === "bot"
                  ? '0px 2px 8px rgba(60, 64, 67, 0.1)'
                  : '0px 2px 8px rgba(26, 115, 232, 0.25)',
                border: m.sender === "bot" ? '1px solid' : 'none',
                borderColor: m.sender === "bot" ? 'divider' : 'transparent',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: m.sender === "bot"
                    ? '0px 4px 12px rgba(60, 64, 67, 0.15)'
                    : '0px 4px 12px rgba(26, 115, 232, 0.35)',
                }
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  fontSize: '0.9375rem',
                }}
              >
                {m.text}
              </Typography>
            </Paper>

            {m.sender === "user" && (
              <Avatar
                sx={{
                  bgcolor: '#5f6368',
                  width: 36,
                  height: 36,
                  boxShadow: '0 2px 6px rgba(95, 99, 104, 0.3)',
                }}
              >
                <PersonIcon fontSize="small" />
              </Avatar>
            )}
          </Box>
        ))}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 1.5,
              animation: 'fadeInUp 0.3s ease-out',
            }}
          >
            <Avatar
              sx={{
                background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                width: 36,
                height: 36,
                boxShadow: '0 2px 8px rgba(26, 115, 232, 0.3)',
              }}
            >
              <SmartToyIcon fontSize="small" />
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                borderBottomLeftRadius: 4,
                bgcolor: 'white',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0px 2px 8px rgba(60, 64, 67, 0.1)',
              }}
            >
              <CircularProgress size={20} thickness={4} />
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 3,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            autoFocus
            inputRef={inputRef}
            variant="outlined"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading) handleSend();
              }
            }}
            multiline
            maxRows={4}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f8f9fa',
                borderRadius: '12px',
                fontSize: '0.9375rem',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            sx={{
              width: 52,
              height: 52,
              background: input.trim()
                ? 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)'
                : '#e8eaed',
              color: input.trim() ? 'white' : '#5f6368',
              boxShadow: input.trim()
                ? '0 2px 8px rgba(26, 115, 232, 0.3)'
                : 'none',
              '&:hover': {
                background: input.trim()
                  ? 'linear-gradient(135deg, #1557b0 0%, #1a73e8 100%)'
                  : '#e8eaed',
                transform: input.trim() ? 'translateY(-2px)' : 'none',
                boxShadow: input.trim()
                  ? '0 4px 12px rgba(26, 115, 232, 0.4)'
                  : 'none',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
              '&.Mui-disabled': {
                background: '#e8eaed',
                color: '#bdc1c6',
              },
              borderRadius: '12px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            mt: 1.5,
            color: 'text.secondary',
            fontSize: '0.75rem',
          }}
        >
          <Box component="span" sx={{ fontSize: '1rem' }}>✨</Box>
          AI can make mistakes. Please verify important information.
        </Typography>
      </Box>
    </Paper>
  );
}