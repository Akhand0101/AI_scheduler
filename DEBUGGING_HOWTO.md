# Debugging and Connection Guide

This guide helps you troubleshoot connection issues (Edge Functions, Backend) and Magic Link login problems.

## 1. Diagnostics Page
We have enhanced the `DebugPage` to perform active checks.

1.  Navigate to `/debug` in your browser (e.g., `http://localhost:5173/debug`).
2.  Review the **Debug Info** JSON to ensure `googleClientId` and `supabaseUrl` are "Present".
3.  Click **Test 'handle-chat' Function**.

### Interpreting 'handle-chat' Results

*   **❌ Connection Failed**:
    *   **Cause**: The frontend cannot reach the backend.
    *   **Fix (Local)**: Ensure you are running `supabase start` or `supabase functions serve`.
    *   **Fix (Vercel)**: Ensure your Edge Functions are deployed (`supabase functions deploy`).
    *   **Check**: Are you using the correct `VITE_SUPABASE_URL`? If local, it should look like `http://127.0.0.1:54321`.

*   **✅ Connection Successful, but 'geminiKey': 'MISSING'**:
    *   **Cause**: The Edge Function is running but doesn't have the `GEMINI_API_KEY`.
    *   **Fix (Local)**: Create a `.env` file in `supabase/` (not frontend) with `GEMINI_API_KEY=...` or restart supabase with environment variables.
    *   **Fix (Vercel/Remote)**: You need to set the secret in Supabase Dashboard: `supabase secrets set GEMINI_API_KEY=...`.

*   **✅ Connection Successful, Chat Logic Success**:
    *   The backend works perfectly! If the Chat UI is still broken, there might be a frontend React error (check Browser Console F12).

## 2. Magic Link / Login Issues

If clicking the email link doesn't log you in:

1.  **Check Redirect URLs**:
    *   Go to **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
    *   The "Site URL" should match your main site.
    *   **Redirect URLs** MUST include the exact localhost URL you are using, e.g., `http://localhost:5173/**`.
    *   Note: `localhost` and `127.0.0.1` are DIFFERENT. If your browser uses `127.0.0.1`, add that too.

2.  **Use the Admin Password Login (Fallback)**:
    *   If Magic Links are flaky (e.g., due to different browser sessions), use the "Password" tab on the Admin page to login reliably during development.

3.  **Check Console**:
    *   Open Developer Tools (F12) -> Console.
    *   Look for any Red errors when the page loads after clicking the link.

## 3. General "No Connection"

If absolutely nothing works:
*   Ensure your internet is active.
*   Ensure Supabase project is not "Paused" (if using free tier remote).
*   Ensure `VITE_SUPABASE_ANON_KEY` is correct in `frontend/.env`.

---
**Need more help?**
Click "Test 'handle-chat' Function" on the Debug page and share the output!
