import { useState } from "react";
import { supabase } from "../supabaseClient";
import { Box, TextField, Button, Alert, CircularProgress } from "@mui/material";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/admin'
      }
    });
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: "Check your email for the login link." });
    }
    setLoading(false);
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        fullWidth
        label="Email Address"
        variant="outlined"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="admin@example.com"
        type="email"
      />
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Send Login Link"}
      </Button>
      {msg && (
        <Alert severity={msg.type} sx={{ mt: 2 }}>
          {msg.text}
        </Alert>
      )}
    </Box>
  );
}
