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
    // 1. Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    // We need the service role key to perform deletions safely if RLS blocks us, 
    // OR we can just use the user's token if RLS allows. 
    // For admin actions, it's often safer to use the user's token to ensure they are an admin.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    // 2. Validate User (Must be authenticated)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Parse Request
    const { appointmentId } = await req.json()
    if (!appointmentId) throw new Error("Missing appointmentId")

    // 4. Fetch Appointment Details (to get Google Event ID and Therapist credential)
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*, therapists(google_refresh_token, google_calendar_id)')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) throw new Error("Appointment not found")

    const therapist = appointment.therapists;

    // 5. Delete from Google Calendar (if connected)
    if (therapist?.google_refresh_token && appointment.google_calendar_event_id) {
        try {
            // Get Access Token
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
            
            if (tokenData.access_token) {
                 const calendarId = therapist.google_calendar_id || 'primary'
                 await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appointment.google_calendar_event_id}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${tokenData.access_token}`,
                        }
                    }
                )
            }
        } catch (e) {
            console.warn("Failed to delete from Google Calendar:", e)
            // Proceed to delete from local DB anyway
        }
    }

    // 6. Delete from Supabase
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)

    if (deleteError) throw deleteError

    // Optional: Update inquiry status back to 'matched' or 'pending'? 
    // For now, let's leave it or maybe set it back so they can book again.
    if (appointment.inquiry_id) {
         await supabase.from('inquiries').update({ status: 'matched' }).eq('id', appointment.inquiry_id)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Cancel Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
