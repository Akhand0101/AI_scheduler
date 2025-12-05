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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchedTherapistId, setMatchedTherapistId] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ... existing imports ...

  // ... inside ChatWindow component ...

  const sendToHandleChat = async (text: string, currentMessages: Message[], therapistId: string | null) => {
    // Convert sender to role and text to content
    const conversationHistory = currentMessages.map(msg => ({
      role: msg.sender,
      content: msg.text
    }));

    const { data, error } = await supabase.functions.invoke('handle-chat', {
      body: {
        userMessage: text,
        conversationHistory: conversationHistory, // Pass the history
        patientId: "anon-123",
        matchedTherapistId: therapistId
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
    const newMessages: Message[] = [...messages, { sender: "user", text: userMsg }];

    setInput("");
    setMessages(newMessages);
    setLoading(true);

    try {
      // 1. Get AI response and check for next actions
      const chatData: any = await sendToHandleChat(userMsg, newMessages, matchedTherapistId);
      const reply = chatData?.message || "I processed that. What's next?";
      setMessages(prev => [...prev, { sender: "bot", text: reply }]);

      // 2. If the next action is to find a therapist, execute it
      if (chatData?.nextAction === 'find-therapist' && chatData?.inquiryId) {
        const { data: therapistData, error: therapistError } = await supabase.functions.invoke('find-therapist', {
          body: { inquiryId: chatData.inquiryId }
        });

        if (therapistError) throw new Error(therapistError.message);
        
        const chosen = therapistData?.chosen;
        let therapistReply = "I'm sorry, I couldn't find a suitable therapist at the moment. Please try again later.";
        
        if (chosen) {
          setMatchedTherapistId(chosen.id);
          therapistReply = `I've found a great match for you: ${chosen.name}.`;
          const therapist = therapistData.matches[0]?.therapist;
          if (therapist?.bio) {
            therapistReply += `\n\nHere's a bit about them: "${therapist.bio}"`;
          }
          therapistReply += `\n\nWould you like to book an appointment with ${chosen.name}?`;
        }
        
        setMessages(prev => [...prev, { sender: "bot", text: therapistReply }]);

      } else if (chatData?.nextAction === 'book-appointment') {
        // 3. If the next action is to book, execute it
        const { data: bookingData, error: bookingError } = await supabase.functions.invoke('book-appointment', {
          body: { ...chatData } // Pass all data from handle-chat
        });

        if (bookingError) throw new Error(bookingError.message);

        const confirmationMessage = bookingData?.success
          ? "Your appointment has been successfully booked! You should receive a calendar invitation shortly."
          : "There was an issue booking your appointment. Please try again.";
          
        setMessages(prev => [...prev, { sender: "bot", text: confirmationMessage }]);
        setMatchedTherapistId(null);
      }

    } catch (err: any) {
      setMessages(prev => [...prev, { sender: "bot", text: `I apologize, an error occurred: ${err.message}` }]);
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