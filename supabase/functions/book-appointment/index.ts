import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 2. Parse Request
    const { inquiryId, therapistId, startTime, endTime, patientName } = await req.json()

    if (!therapistId || !startTime || !endTime) {
      throw new Error("Missing required appointment details.")
    }

    // 3. Fetch Therapist Credentials (Refresh Token)
    const { data: therapist, error: therapistError } = await supabase
      .from('therapists')
      .select('google_refresh_token, google_calendar_id')
      .eq('id', therapistId)
      .single()

    if (therapistError || !therapist?.google_refresh_token) {
      throw new Error("Therapist calendar not connected.")
    }

    // 4. Get Google Access Token (using Refresh Token)
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: therapist.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
      console.error("Token Error:", tokenData)
      throw new Error("Failed to refresh Google access token")
    }

    // 5. Create Event on Google Calendar
    const calendarId = therapist.google_calendar_id || 'primary'
    const eventBody = {
      summary: `Therapy Session with ${patientName || 'Patient'}`,
      description: `Inquiry ID: ${inquiryId}`,
      start: { dateTime: startTime }, // ISO format: "2023-10-27T10:00:00Z"
      end: { dateTime: endTime },
    }

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    )

    const eventData = await calendarResponse.json()
    if (!eventData.id) {
      console.error("Calendar Error:", eventData)
      throw new Error("Failed to create Google Calendar event")
    }

    // 6. Save to Supabase 'appointments' table
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        inquiry_id: inquiryId,
        therapist_id: therapistId,
        start_time: startTime,
        end_time: endTime,
        google_calendar_event_id: eventData.id,
        status: 'confirmed'
      })
      .select()
      .single()

    if (apptError) throw apptError

    // 7. Update Inquiry Status
    if (inquiryId) {
      await supabase
        .from('inquiries')
        .update({ status: 'scheduled' })
        .eq('id', inquiryId)
    }

    return new Response(
      JSON.stringify({ success: true, appointment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})