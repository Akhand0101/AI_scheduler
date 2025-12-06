import { useState } from "react";
import { supabase } from "../supabaseClient";
import { Box, TextField, Button, Alert, CircularProgress, Tabs, Tab } from "@mui/material";

export default function AdminLoginPassword() {
    const [tab, setTab] = useState(0); // 0 = magic link, 1 = password
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleMagicLink = async () => {
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
            setMsg({ type: 'success', text: "Check your email for the login link. Link expires in 10 minutes." });
        }
        setLoading(false);
    };

    const handlePasswordLogin = async () => {
        if (!email || !password) {
            setMsg({ type: 'error', text: "Please enter both email and password" });
            return;
        }
        setLoading(true);
        setMsg(null);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            setMsg({ type: 'error', text: error.message });
        } else {
            setMsg({ type: 'success', text: "Login successful!" });
            // Page will auto-refresh on session change
        }
        setLoading(false);
    };

    const handleSignup = async () => {
        if (!email || !password) {
            setMsg({ type: 'error', text: "Please enter both email and password" });
            return;
        }
        setLoading(true);
        setMsg(null);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin + '/admin'
            }
        });
        if (error) {
            setMsg({ type: 'error', text: error.message });
        } else {
            setMsg({ type: 'success', text: "Account created! Please check your email to confirm." });
        }
        setLoading(false);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab label="Magic Link" />
                <Tab label="Password" />
            </Tabs>

            {tab === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                        onClick={handleMagicLink}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Send Login Link"}
                    </Button>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        fullWidth
                        label="Email Address"
                        variant="outlined"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        type="email"
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        variant="outlined"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        type="password"
                        onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handlePasswordLogin}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
                        </Button>
                        <Button
                            fullWidth
                            variant="outlined"
                            size="large"
                            onClick={handleSignup}
                            disabled={loading}
                        >
                            Sign Up
                        </Button>
                    </Box>
                </Box>
            )}

            {msg && (
                <Alert severity={msg.type} sx={{ mt: 2 }}>
                    {msg.text}
                </Alert>
            )}
        </Box>
    );
}
