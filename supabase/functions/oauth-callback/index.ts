// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 1. Get Code from Body
    const { code, redirect_uri } = await req.json()
    if (!code) throw new Error('No code provided')

    // 2. Exchange Code for Tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Google Client ID/Secret not configured')
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri || '',
      }),
    })

    const tokens = await tokenResponse.json()
    if (tokens.error) {
      console.error("Google Token Error:", tokens)
      throw new Error(`Google Token Error: ${tokens.error_description || tokens.error}`)
    }

    // 3. Identify User (Therapist)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) throw new Error('Unauthorized')

    // 4. Update Therapist Record
    // We try to update the therapist record associated with this user.
    // First, try to find a therapist where user_id matches.

    // Note: We only store the refresh_token persistently. Access tokens expire.
    // We might also want to store google_calendar_id if not present.
    const updateData = {
      google_refresh_token: tokens.refresh_token,
      // If we got a refresh token, we should probably mark them as connected
    }

    // Try updating by user_id (assuming 1:1 mapping)
    // We use 'select' to check if it worked
    let { data: updated, error: updateError } = await supabase
      .from('therapists')
      .update(updateData)
      .eq('user_id', user.id)
      .select()

    // If no rows updated (maybe column doesn't exist or no match), try updating by id
    if (!updated || updated.length === 0) {
      const { data: updatedById, error: updateError2 } = await supabase
        .from('therapists')
        .update(updateData)
        .eq('id', user.id) // Assuming therapist.id might be the same as auth.user.id
        .select()

      if (updateError2) throw updateError2
      updated = updatedById
    }

    if (updateError && !updated) throw updateError

    return new Response(
      JSON.stringify({ success: true, message: "Calendar connected successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("OAuth Callback Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
