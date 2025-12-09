import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminLoginPassword from "../components/AdminLoginPassword";
import InquiryList from "../components/InquiryList";
import AppointmentList from "../components/AppointmentList";
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container, 
  Chip,
  Grid,
  alpha
} from "@mui/material";
import { 
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  Link as LinkIcon,
  Logout as LogoutIcon
} from "@mui/icons-material";

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [therapist, setTherapist] = useState<any>(null);

  async function getAdminData() {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke('get-admin-data');
      if (error) throw error;

      // Update therapist state if returned
      if (data && data.therapist && data.therapist.length > 0) {
        setTherapist(data.therapist[0]);
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  }

  useEffect(() => {
    // Handle magic link callback - Supabase will automatically parse the hash
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);

      // Clean up the URL hash if it contains auth tokens
      if (window.location.hash && window.location.hash.includes('access_token')) {
        // Replace the URL to remove the hash without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);

      // Also clean up hash on auth state change
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      getAdminData();
    }
  }, [session]);

  const handleConnectCalendar = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!clientId) {
      alert("Configuration Error: VITE_GOOGLE_CLIENT_ID is missing in your frontend .env file. Please add it to enable calendar integration.");
      return;
    }

    if (!supabaseUrl) {
      alert("Configuration Error: VITE_SUPABASE_URL is missing in your frontend .env file.");
      return;
    }

    if (!therapist?.id) {
      alert("Error: No therapist profile found. Please ensure you are logged in correctly and your account is linked to a therapist profile.");
      return;
    }

    // Redirect to the Supabase Edge Function, which will handle the token exchange
    // and then redirect back to /admin with ?success=true
    const redirectUri = `${supabaseUrl}/functions/v1/google-callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.events';

    // Pass therapist ID as state to identify which therapist is connecting
    const state = therapist.id;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`;

    window.location.href = authUrl;
  };

  // Handle successful OAuth callback (checking for ?success=true in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');

    if (success === 'true' && session) {
      // Clean URL to avoid re-triggering on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      alert("Calendar connected successfully!");
      // Refresh admin data to show "Connected" status
      getAdminData();
    }
  }, [session]);

  const handleDisconnectCalendar = async () => {
    if (!session?.user?.id) return;

    // Attempt to clear the token from the database
    const { error } = await supabase
      .from('therapists')
      .update({ google_refresh_token: null })
      .eq('user_id', session.user.id); // Securely match the logged-in user

    if (error) {
      console.error("Disconnect error:", error);
      alert("Failed to disconnect: " + error.message);
    } else {
      // Refresh local state to show "Connect" button again
      setTherapist({ ...therapist, google_refresh_token: null });
      alert("Calendar disconnected. You can now connect again to fix sync issues.");
    }
  };

  if (!session) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 5, 
              textAlign: 'center',
              borderRadius: 4,
              boxShadow: '0px 8px 24px rgba(60, 64, 67, 0.15)',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(26, 115, 232, 0.3)',
                mx: 'auto',
                mb: 3,
              }}
            >
              <CalendarIcon sx={{ color: 'white', fontSize: 32 }} />
            </Box>
            <Typography 
              variant="h4" 
              gutterBottom 
              sx={{ 
                fontWeight: 700,
                mb: 1,
              }}
            >
              Admin Dashboard
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary" 
              sx={{ mb: 4 }}
            >
              Sign in to manage appointments and patient inquiries
            </Typography>
            <AdminLoginPassword />
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 4,
          pb: 3,
          borderBottom: '2px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 700,
              mb: 0.5,
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your appointments and patient inquiries
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          sx={{
            borderRadius: '24px',
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Calendar Sync Card */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 4, 
          mb: 4,
          borderRadius: 3,
          background: therapist?.google_refresh_token
            ? `linear-gradient(135deg, ${alpha('#1e8e3e', 0.05)} 0%, ${alpha('#34a853', 0.05)} 100%)`
            : `linear-gradient(135deg, ${alpha('#1a73e8', 0.05)} 0%, ${alpha('#4285f4', 0.05)} 100%)`,
          border: '1px solid',
          borderColor: therapist?.google_refresh_token ? alpha('#1e8e3e', 0.2) : alpha('#1a73e8', 0.2),
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0px 8px 20px rgba(60, 64, 67, 0.15)',
          }
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: therapist?.google_refresh_token
                    ? 'linear-gradient(135deg, #1e8e3e 0%, #34a853 100%)'
                    : 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: therapist?.google_refresh_token
                    ? '0 2px 8px rgba(30, 142, 62, 0.3)'
                    : '0 2px 8px rgba(26, 115, 232, 0.3)',
                }}
              >
                {therapist?.google_refresh_token ? (
                  <CheckIcon sx={{ color: 'white', fontSize: 28 }} />
                ) : (
                  <LinkIcon sx={{ color: 'white', fontSize: 28 }} />
                )}
              </Box>
              <Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  Google Calendar Sync
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {therapist?.google_refresh_token
                    ? "Your calendar is synced and appointments will be automatically added"
                    : "Connect your Google Calendar to sync appointments automatically"}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            {therapist?.google_refresh_token ? (
              <Chip
                label="Connected"
                color="success"
                onDelete={handleDisconnectCalendar}
                variant="outlined"
                sx={{
                  height: 40,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  borderWidth: '2px',
                  '& .MuiChip-deleteIcon': {
                    fontSize: '1.25rem',
                  }
                }}
              />
            ) : (
              <Button
                variant="contained"
                size="large"
                startIcon={<CalendarIcon />}
                onClick={handleConnectCalendar}
                sx={{
                  borderRadius: '24px',
                  px: 3,
                }}
              >
                Connect Calendar
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Data Tables */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 4,
              borderRadius: 3,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                boxShadow: '0px 8px 20px rgba(60, 64, 67, 0.15)',
              }
            }}
          >
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                color: 'primary.main',
                fontWeight: 600,
                mb: 3,
              }}
            >
              Patient Inquiries
            </Typography>
            <InquiryList />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 4,
              borderRadius: 3,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                boxShadow: '0px 8px 20px rgba(60, 64, 67, 0.15)',
              }
            }}
          >
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                color: 'primary.main',
                fontWeight: 600,
                mb: 3,
              }}
            >
              Scheduled Appointments
            </Typography>
            <AppointmentList />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
