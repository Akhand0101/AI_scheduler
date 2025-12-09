import ChatWindow from "../components/ChatWindow";
import { Box, Typography, Container, alpha } from "@mui/material";
import { AutoAwesome as AutoAwesomeIcon } from "@mui/icons-material";

export default function ChatPage() {
  return (
    <Container maxWidth="lg">
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 5,
          pb: 6,
        }}
      >
        {/* Hero Section - Google AI Studio Style */}
        <Box 
          sx={{ 
            textAlign: 'center',
            maxWidth: 800,
            mx: 'auto',
            position: 'relative',
            pt: 2,
          }}
        >
          {/* Decorative Background Gradient */}
          <Box
            sx={{
              position: 'absolute',
              top: '-100px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '600px',
              height: '600px',
              background: `radial-gradient(circle, ${alpha('#1a73e8', 0.08)} 0%, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />

          {/* Icon Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1,
              mb: 3,
              borderRadius: '24px',
              bgcolor: alpha('#1a73e8', 0.08),
              border: `1px solid ${alpha('#1a73e8', 0.2)}`,
            }}
          >
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                letterSpacing: '0.05em',
                fontSize: '0.8rem',
              }}
            >
              AI-POWERED ASSISTANT
            </Typography>
          </Box>

          {/* Main Heading */}
          <Typography 
            variant="h2" 
            component="h1" 
            gutterBottom 
            sx={{ 
              fontWeight: 700,
              color: 'text.primary',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              lineHeight: 1.2,
            }}
          >
            How can we{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              help you
            </Box>
            {' '}today?
          </Typography>

          {/* Subtitle */}
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              fontSize: '1.125rem',
              lineHeight: 1.6,
              mb: 1,
            }}
          >
            Chat with our intelligent AI assistant to schedule therapy appointments,
            check availability, or ask about insurance coverage.
          </Typography>

          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              display: 'block',
              fontSize: '0.875rem',
            }}
          >
            Fast • Secure • Confidential
          </Typography>
        </Box>

        {/* Chat Window */}
        <ChatWindow />
      </Box>
    </Container>
  );
}
