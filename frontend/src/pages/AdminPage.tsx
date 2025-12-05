import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AdminLogin from "../components/AdminLogin";
import InquiryList from "../components/InquiryList";
import AppointmentList from "../components/AppointmentList";
import { Box, Button, Typography, Paper, Container } from "@mui/material";

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">Admin Access</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please sign in to manage appointments and inquiries.
          </Typography>
          <AdminLogin />
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
