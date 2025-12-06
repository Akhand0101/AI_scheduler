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
    { sender: "bot", text: "Hello! I'm Akhand's AI assistant. I can help you book appointments or answer questions about our services." }
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

  const sendToHandleChat = async (text: string, currentMatchedId: string | null) => {
    const { data, error } = await supabase.functions.invoke('handle-chat', {
      body: {
        userMessage: text,
        patientId: patientId,
        matchedTherapistId: currentMatchedId
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

      // FIX: Use the natural language 'message' from the AI
      const reply = data?.message || "I processed that, but didn't get a specific response.";

      // Debugging: Log the extracted data to console to verify it's working
      if (data?.extractedData) {
        console.log("AI Extracted:", data.extractedData);
      }

      setMessages(prev => [...prev, { sender: "bot", text: reply }]);

      // --- Orchestration Logic ---
      if (data?.nextAction === 'find-therapist' && data.inquiryId) {
        setMessages(prev => [...prev, { sender: 'bot', text: "🔍 Searching our database for the best specialist..." }]);

        const { data: findData, error: findError } = await supabase.functions.invoke('find-therapist', {
          body: { inquiryId: data.inquiryId }
        });

        if (findError) {
          console.error(findError);
          setMessages(prev => [...prev, { sender: 'bot', text: "I encountered an error searching for therapists." }]);
        } else if (findData.matches && findData.matches.length > 0) {
          const topMatch = findData.matches[0].therapist;
          setMatchedTherapistId(topMatch.id);
          // Inform the user
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: `I found a match!\n\nDr. ${topMatch.name}\nMatches your needs for: ${topMatch.specialties?.join(", ")}\n\nWould you like to book an appointment with them?`
          }]);
        } else {
          setMessages(prev => [...prev, { sender: 'bot', text: "I couldn't find a therapist matching your specific criteria right now." }]);
        }
      }

      if (data?.nextAction === 'book-appointment' && data.therapistId && data.startTime) {
        setMessages(prev => [...prev, { sender: 'bot', text: "📅 Booking your appointment now..." }]);

        const { data: bookData, error: bookError } = await supabase.functions.invoke('book-appointment', {
          body: {
            inquiryId: data.inquiryId,
            therapistId: data.therapistId,
            startTime: data.startTime,
            endTime: data.endTime,
            patientName: "Guest Patient"
          }
        });

        if (bookError) {
          setMessages(prev => [...prev, { sender: 'bot', text: `Failed to book: ${bookError.message}` }]);
        } else {
          const dateStr = new Date(data.startTime).toLocaleString();
          setMessages(prev => [...prev, { sender: 'bot', text: `✅ SUCCESS! Appointment confirmed for ${dateStr}.` }]);

          if (bookData?.googleCalendarError) {
            setMessages(prev => [...prev, { sender: 'bot', text: `⚠️ Calendar Sync Warning: The appointment was saved locally, but failed to sync to Google Calendar.\n\nReason: ${bookData.googleCalendarError}` }]);
          } else {
            setMessages(prev => [...prev, { sender: 'bot', text: `📅 A Google Calendar invite has been sent to the therapist.` }]);
          }
        }
      }

    } catch (err: any) {
      setMessages(prev => [...prev, { sender: "bot", text: "I apologize, but I'm having trouble connecting right now. Please try again later." }]);
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