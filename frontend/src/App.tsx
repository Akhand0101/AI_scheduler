
import { Routes, Route, Link, useLocation } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Button, Box, Container } from "@mui/material";
import theme from "./theme";

export default function App() {
  const location = useLocation();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'white' }}>
          <Container maxWidth="lg">
            <Toolbar disableGutters>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, color: 'primary.main' }}>
                Akhand Health
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  component={Link}
                  to="/chat"
                  color={location.pathname.includes('/chat') || location.pathname === '/' ? "primary" : "inherit"}
                  variant={location.pathname.includes('/chat') || location.pathname === '/' ? "contained" : "text"}
                >
                  Chat
                </Button>
                <Button
                  component={Link}
                  to="/admin"
                  color={location.pathname.includes('/admin') ? "primary" : "inherit"}
                  variant={location.pathname.includes('/admin') ? "contained" : "text"}
                >
                  Admin
                </Button>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
          <Container maxWidth="lg">
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Container>
        </Box>

        <Box component="footer" sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            © {new Date().getFullYear()} Akhand Health. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
