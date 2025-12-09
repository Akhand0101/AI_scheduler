import { Routes, Route, Link, useLocation } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import DebugPage from "./pages/DebugPage";
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  alpha
} from "@mui/material";
import {
  AutoAwesome as AutoAwesomeIcon,
  Chat as ChatIcon,
  Dashboard as DashboardIcon
} from "@mui/icons-material";
import theme from "./theme";

export default function App() {
  const location = useLocation();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)',
        }}
      >
        {/* Glassmorphic Modern Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 2px rgba(60, 64, 67, 0.1)',
          }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ py: 1 }}>
              {/* Logo and Brand */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexGrow: 1
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(26, 115, 232, 0.3)',
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    component={Link}
                    to="/"
                    sx={{
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textDecoration: 'none',
                      fontFamily: '"DM Sans", sans-serif',
                      fontSize: '1.35rem',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Kai Health Bot
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      letterSpacing: '0.05em',
                      display: 'block',
                      lineHeight: 1,
                      mt: -0.5
                    }}
                  >
                    AI-POWERED CARE
                  </Typography>
                </Box>
              </Box>

              {/* Navigation Buttons */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  component={Link}
                  to="/chat"
                  startIcon={<ChatIcon />}
                  variant={location.pathname.includes('/chat') || location.pathname === '/' ? "contained" : "text"}
                  sx={{
                    color: location.pathname.includes('/chat') || location.pathname === '/'
                      ? 'white'
                      : 'text.primary',
                    bgcolor: location.pathname.includes('/chat') || location.pathname === '/'
                      ? 'primary.main'
                      : 'transparent',
                    '&:hover': {
                      bgcolor: location.pathname.includes('/chat') || location.pathname === '/'
                        ? 'primary.dark'
                        : alpha('#1a73e8', 0.08),
                    },
                  }}
                >
                  Chat
                </Button>
                <Button
                  component={Link}
                  to="/admin"
                  startIcon={<DashboardIcon />}
                  variant={location.pathname.includes('/admin') ? "contained" : "outlined"}
                  sx={{
                    color: location.pathname.includes('/admin')
                      ? 'white'
                      : 'primary.main',
                  }}
                >
                  Admin
                </Button>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, py: 6 }}>
          <Container maxWidth="lg">
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/debug" element={<DebugPage />} />
            </Routes>
          </Container>
        </Box>

        {/* Modern Footer */}
        <Box
          component="footer"
          sx={{
            py: 4,
            mt: 4,
            textAlign: 'center',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                Kai Health Bot
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              © {new Date().getFullYear()} Kai Health Bot. Powered by AI. All rights reserved.
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mt: 0.5,
                fontSize: '0.7rem',
              }}
            >
              Your health journey, intelligently supported
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
