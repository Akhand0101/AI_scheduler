
import ChatWindow from "../components/ChatWindow";
import { Box, Typography } from "@mui/material";

export default function ChatPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          How can we help you today?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Chat with our AI assistant to schedule appointments, check availability, or ask about insurance.
        </Typography>
      </Box>
      <ChatWindow />
    </Box>
  );
}
