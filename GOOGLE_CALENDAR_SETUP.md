# Google Calendar Sync Setup Guide

## 🔍 Issue
Appointments are saving successfully, but Google Calendar sync is failing with the error:
> "No Google Refresh Token found for therapist."

## ✅ Solution Steps

### 1. **Verify Frontend Environment Variables**

Create or update `frontend/.env` with these variables:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_SUPABASE_URL=https://qhuqwljmphigdvcwwzg.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**How to get Google Client ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to "APIs & Services" → "Credentials"
4. Create "OAuth 2.0 Client ID" (Web application)
5. Add authorized redirect URI: `https://qhuqwljmphigdvcwwzg.supabase.co/functions/v1/google-callback`
6. Copy the Client ID

### 2. **Verify Supabase Secrets**

Make sure these secrets are set in your Supabase project:

```bash
# Check secrets
npx supabase secrets list

# If missing, set them:
npx supabase secrets set GOOGLE_CLIENT_ID=your-client-id
npx supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. **Connect Google Calendar (Admin Page)**

1. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Navigate to Admin Page:**
   - Go to `http://localhost:5173/admin`
   - Log in with therapist email (magic link will be sent)

3. **Connect Calendar:**
   - Click **"Connect Google Calendar"** button
   - Authorize with your Google account
   - Grant calendar permissions
   - You'll be redirected back with success message

4. **Verify Connection:**
   - The admin page should show a green **"Connected"** chip
   - If you see "Connected", Google Calendar is now synced!

### 4. **Test Appointment Booking**

1. Go back to the chat page
2. Book a new appointment through the chatbot
3. Check the appointment in:
   - ✅ Your app's Appointments list (Admin page)
   - ✅ Your Google Calendar

---

## 🐛 Troubleshooting

### Error: "VITE_GOOGLE_CLIENT_ID is missing"
**Fix:** Add `VITE_GOOGLE_CLIENT_ID` to `frontend/.env` and restart dev server

### Error: "404: NOT_FOUND" after Google OAuth
**Fix:** 
1. Make sure `google-callback` edge function is deployed
2. Check that redirect URI matches exactly in Google Console

### Error: "Google Calendar API error (403)"
**Fix:**
1. Enable Google Calendar API in Google Cloud Console
2. Go to "APIs & Services" → "Library"
3. Search for "Google Calendar API"
4. Click "Enable"

### Calendar shows "Connected" but events don't sync
**Fix:**
1. Disconnect and reconnect calendar from Admin page
2. Check Supabase logs for errors:
   ```bash
   # View edge function logs
   npx supabase functions logs book-appointment
   ```

---

## 📚 Technical Details

### How Google Calendar Sync Works:

1. **Admin connects calendar** → `google-callback` edge function stores `refresh_token`
2. **User books appointment** → `book-appointment` edge function:
   - Fetches therapist's `google_refresh_token`
   - Exchanges it for `access_token`
   - Creates event on Google Calendar
   - Saves appointment to database
3. **If sync fails** → Appointment still saves, but `googleCalendarError` is returned

### Database Schema:
```sql
-- therapists table
google_refresh_token: text (encrypted OAuth refresh token)
google_calendar_id: text (usually "primary")

-- appointments table
google_calendar_event_id: text (links to Google Calendar event)
```

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Admin page shows "Connected" chip (green)
- ✅ New appointments appear in Google Calendar automatically
- ✅ No `googleCalendarError` in booking response
- ✅ `google_calendar_event_id` is populated in appointments table

---

## 🎯 Next Steps

1. Set up Google OAuth credentials
2. Add environment variables
3. Connect calendar from admin page
4. Test booking flow end-to-end

**Need help?** Check the Supabase logs and browser console for detailed error messages.
