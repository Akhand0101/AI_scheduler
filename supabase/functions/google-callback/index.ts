import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const therapistId = url.searchParams.get('state') // We passed this earlier
  const error = url.searchParams.get('error')

  if (error || !code || !therapistId) {
    return new Response(`Error: ${error || 'Missing code/state'}`, { status: 400 })
  }

  try {
    // 1. Exchange Code for Tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = 'https://qhuqwljmphigdvcwwzgg.supabase.co/functions/v1/google-callback' // UPDATE THIS!

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    
    if (!tokens.refresh_token) {
      // Note: If you don't get a refresh token, it's usually because 
      // access_type=offline wasn't sent or the user was already authorized.
      // prompt=consent fixes this.
      throw new Error("No refresh token returned from Google.")
    }

    // 2. Save Refresh Token to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use SERVICE ROLE to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: dbError } = await supabase
      .from('therapists')
      .update({ 
        google_refresh_token: tokens.refresh_token,
        google_calendar_id: 'primary' // Default to their main calendar
      })
      .eq('id', therapistId)

    if (dbError) throw dbError

    // 3. Redirect back to your React Admin App
    return Response.redirect('http://localhost:5173/admin?success=true', 302)

  } catch (err) {
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    return new Response(`OAuth Failed: ${errorMessage}`, { status: 500 })
  }
})