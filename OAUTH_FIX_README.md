# Google Calendar OAuth Fix - Summary

## Problem
You were getting a 404 error when trying to connect Google Calendar from the admin page. The OAuth flow was redirecting back to `/admin` on your Vercel app, but since your frontend is a React SPA, there's no server-side route handler for `/admin` to process the OAuth callback, resulting in a 404.

## Root Cause
There was a mismatch in the OAuth flow design:
- The `redirect_uri` was set to `https://ai-scheduler-oqbk.vercel.app/admin`
- Google would redirect there with the authorization code
- But your React app couldn't handle this properly, causing a 404

## Solution Implemented
Changed the OAuth flow to use the **Supabase Edge Function** (`google-callback`) as the redirect URI instead of the frontend:

### Changes Made:

1. **AdminPage.tsx** - Updated the OAuth flow:
   - Changed `redirect_uri` to point to the Supabase Edge Function: `{VITE_SUPABASE_URL}/functions/v1/google-callback`
   - Added therapist ID as `state` parameter to identify which therapist is connecting
   - Simplified the callback handler to just check for `?success=true` instead of handling the authorization code

2. **google-callback/index.ts** - Updated the edge function:
   - Made `redirectUri` dynamic using the `SUPABASE_URL` environment variable
   - The function now properly receives the OAuth callback from Google, exchanges the code for tokens, saves them to the database, and redirects back to `/admin?success=true`

## What You Need to Do Next

### 1. Set Environment Variables

You need to ensure these environment variables are set in your **Supabase Dashboard** (Project Settings → Edge Functions):

- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret  
- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://qhuqwljmphigdvcwwzgg.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for bypassing RLS)
- `SITE_URL` - Your frontend URL (e.g., `https://ai-scheduler-oqbk.vercel.app`)

### 2. Update Google OAuth Redirect URI

In your **Google Cloud Console** (APIs & Services → Credentials):
1. Find your OAuth 2.0 Client ID
2. Add this to **Authorized redirect URIs**:
   ```
   https://qhuqwljmphigdvcwwzgg.supabase.co/functions/v1/google-callback
   ```
   (Replace with your actual Supabase URL)

### 3. Ensure Frontend Environment Variables

Make sure your frontend `.env` file has:
```
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_SUPABASE_URL=https://qhuqwljmphigdvcwwzgg.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Deploy the Edge Function

If you haven't already deployed the updated `google-callback` function:
```bash
supabase functions deploy google-callback
```

## How It Works Now

1. User clicks "Connect Google Calendar" on admin page
2. Redirects to Google OAuth with `redirect_uri` = Supabase Edge Function
3. User grants permission
4. Google redirects to `https://your-supabase-url/functions/v1/google-callback?code=...&state=therapist_id`
5. Edge function:
   - Receives the code
   - Exchanges it for access/refresh tokens
   - Saves refresh token to `therapists` table
   - Redirects to `https://your-frontend-url/admin?success=true`
6. Frontend detects `?success=true` and shows success message

## Testing
Once you've completed the steps above, try connecting the calendar again. You should no longer see the 404 error.
