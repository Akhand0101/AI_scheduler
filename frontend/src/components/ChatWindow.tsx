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

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "Hi there! 👋 I'm here to help you find the right therapist. Whether you're dealing with anxiety, depression, relationship issues, or just need someone to talk to - I'm here to listen and connect you with someone who can help. What brings you here today?" }
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

      // --- Handle therapist selection ---
      if (data?.nextAction === 'therapist-selected' && data.therapistId) {
        setMatchedTherapistId(data.therapistId);
        setPendingTherapistMatches(null); // Clear pending matches

        setMessages(prev => [...prev, {
          sender: 'bot',
          text: "Great choice! When would you like to schedule your appointment? Please let me know your preferred date and time."
        }]);
      }

      // --- Orchestration Logic ---
      if (data?.nextAction === 'find-therapist' && data.inquiryId) {
        setMessages(prev => [...prev, { sender: 'bot', text: "🔍 Let me find some great therapists who match your needs..." }]);

        const { data: findData, error: findError } = await supabase.functions.invoke('find-therapist', {
          body: { inquiryId: data.inquiryId, limit: 3 }
        });

        if (findError) {
          console.error(findError);
          setMessages(prev => [...prev, { sender: 'bot', text: "I encountered an error searching for therapists." }]);
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
          let matchesText = "Perfect! I found some great therapists for you:\\n\\n";
          findData.matches.forEach((match: any, index: number) => {
            const t = match.therapist;
            const specialtiesStr = Array.isArray(t.specialties) ? t.specialties.slice(0, 3).join(", ") : "Multiple areas";
            const insuranceStr = Array.isArray(t.accepted_insurance) ? t.accepted_insurance.slice(0, 2).join(", ") : "Various providers";

            matchesText += `${index + 1}. **${t.name}**\\n`;
            matchesText += `   Specialties: ${specialtiesStr}\\n`;
            matchesText += `   Accepts: ${insuranceStr}\\n`;
            if (t.bio) {
              const shortBio = t.bio.substring(0, 100) + (t.bio.length > 100 ? "..." : "");
              matchesText += `   ${shortBio}\\n`;
            }
            matchesText += "\\n";
          });

          matchesText += "Which therapist would you like to book with? Just let me know the number (e.g., '1', 'the first one', 'number 2', etc.)";

          setMessages(prev => [...prev, {
            sender: 'bot',
            text: matchesText
          }]);
        } else {
          setMessages(prev => [...prev, { sender: 'bot', text: "I couldn't find any therapists matching your specific criteria right now. Would you like to adjust your requirements?" }]);
        }
      }

      if (data?.nextAction === 'book-appointment' && data.therapistId && data.startTime) {
        setMessages(prev => [...prev, { sender: 'bot', text: "📅 Perfect! Let me book that appointment for you..." }]);

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
        } else {
          const dateStr = new Date(data.startTime).toLocaleString();
          setMessages(prev => [...prev, { sender: 'bot', text: `✅ All set! Your appointment is confirmed for ${dateStr}. You should receive a confirmation shortly.` }]);

          if (bookData?.googleCalendarError) {
            setMessages(prev => [...prev, { sender: 'bot', text: `⚠️ Note: The appointment was saved, but there was an issue syncing with the therapist's Google Calendar. They'll still see your appointment in our system.` }]);
          } else {
            setMessages(prev => [...prev, { sender: 'bot', text: `📧 A calendar invite has been sent to your therapist. Looking forward to your session!` }]);
          }

          // Clear state after successful booking
          setMatchedTherapistId(null);
          setPendingTherapistMatches(null);
        }
      }

    } catch (err: any) {
      setMessages(prev => [...prev, { sender: "bot", text: "I'm having a bit of trouble connecting right now. Could you try that again?" }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 800,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper'
      }}
    >
      {/* Messages Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: '#fafafa' }}>
        {messages.map((m, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
              alignItems: 'flex-end',
              gap: 1
            }}
          >
            {m.sender === "bot" && (
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                <SmartToyIcon fontSize="small" />
              </Avatar>
            )}

            <Paper
              elevation={0}
              sx={{
                p: 2,
                maxWidth: '70%',
                borderRadius: 2,
                borderBottomLeftRadius: m.sender === "bot" ? 0 : 2,
                borderBottomRightRadius: m.sender === "user" ? 0 : 2,
                bgcolor: m.sender === "user" ? 'primary.main' : 'white',
                color: m.sender === "user" ? 'primary.contrastText' : 'text.primary',
                boxShadow: m.sender === "bot" ? '0px 2px 4px rgba(0,0,0,0.05)' : 'none',
                border: m.sender === "bot" ? '1px solid' : 'none',
                borderColor: 'divider'
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {m.text}
              </Typography>
            </Paper>

            {m.sender === "user" && (
              <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                <PersonIcon fontSize="small" />
              </Avatar>
            )}
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              <SmartToyIcon fontSize="small" />
            </Avatar>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, borderBottomLeftRadius: 0, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
              <CircularProgress size={20} color="primary" />
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            multiline
            maxRows={4}
            disabled={loading}
            InputProps={{
              sx: { bgcolor: '#f8fafc' }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            sx={{
              width: 56,
              height: 56,
              bgcolor: input.trim() ? 'primary.main' : 'action.disabledBackground',
              color: input.trim() ? 'white' : 'action.disabled',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              borderRadius: 2
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'center', color: 'text.secondary' }}>
          AI can make mistakes. Please verify important information.
        </Typography>
      </Box>
    </Paper>
  );
}