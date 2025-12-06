import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const redirectUri = 'https://qhuqwljmphigdvcwwzgg.supabase.co/functions/v1/connect-google' // UPDATE THIS!
  
  // Get the therapist ID from the request URL query params
  const url = new URL(req.url)
  const therapistId = url.searchParams.get('therapistId')

  if (!therapistId) {
    return new Response("Missing therapistId", { status: 400 })
  }

  // Construct Google's OAuth URL
  const target = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  target.searchParams.set('client_id', clientId!)
  target.searchParams.set('redirect_uri', redirectUri)
  target.searchParams.set('response_type', 'code')
  target.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
  target.searchParams.set('access_type', 'offline') // CRITICAL: Gives us a Refresh Token
  target.searchParams.set('prompt', 'consent')      // CRITICAL: Forces consent screen every time
  
  // Pass therapistId as "state" so we remember who this is when they come back
  target.searchParams.set('state', therapistId)

  // Redirect the user's browser to Google
  return Response.redirect(target.toString(), 302)
})