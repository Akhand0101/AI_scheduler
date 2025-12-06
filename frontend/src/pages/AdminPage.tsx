import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminLoginPassword from "../components/AdminLoginPassword";
import InquiryList from "../components/InquiryList";
import AppointmentList from "../components/AppointmentList";
import { Box, Button, Typography, Paper, Container, Chip } from "@mui/material";

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
      alert("Error: Unable to identify therapist. Please refresh the page and try again.");
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
    // TODO: Implement disconnect logic
    console.log("Disconnecting calendar...");
  };

  if (!session) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">Admin Access</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please sign in to manage appointments and inquiries.
          </Typography>
          <AdminLoginPassword />
        </Paper>
      </Container>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold">Dashboard</Typography>
        <Button
          variant="outlined"
          color="secondary"
          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
        >
          Logout
        </Button>
      </Box>

      <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Calendar Sync</Typography>
          <Typography variant="body2" color="text.secondary">
            {therapist?.google_refresh_token
              ? "Your Google Calendar is synced."
              : "Connect your Google Calendar to sync appointments automatically."}
          </Typography>
        </Box>
        {therapist?.google_refresh_token ? (
          <Chip
            label="Connected"
            color="success"
            onDelete={handleDisconnectCalendar} // Using onDelete to get a nice "X" icon
            variant="outlined"
          />
        ) : (
          <Button
            variant="contained"
            onClick={handleConnectCalendar}
          >
            Connect Google Calendar
          </Button>
        )}
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>Inquiries</Typography>
          <InquiryList />
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>Appointments</Typography>
          <AppointmentList />
        </Paper>
      </Box>
    </Box>
  );
}
