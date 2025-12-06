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
    // 1. Initialize Supabase Client
    // We create the client specifically to validate the user's session
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 2. Authenticate User
    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // Verify the user using getUser()
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // (Optional) Check for specific admin role/email if you want to restrict further
    // if (user.email !== 'admin@example.com') { ... }

    // 3. Fetch Data
    // We can use Promise.all to fetch both tables in parallel for speed
    const [inquiriesResponse, appointmentsResponse, therapistResponse] = await Promise.all([
      supabase
        .from('inquiries')
        .select(`
          *,
          therapists ( name ) 
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('appointments')
        .select(`
          *,
          therapists ( name )
        `)
        .order('start_time', { ascending: false }),

      // Fetch the therapist record for the current user to get their ID and calendar status
      supabase
        .from('therapists')
        .select('*')
        .eq('user_id', user.id)
        .single()
    ])

    if (inquiriesResponse.error) throw inquiriesResponse.error
    if (appointmentsResponse.error) throw appointmentsResponse.error
    // We don't throw for therapist error because maybe they aren't a therapist yet, 
    // or the record doesn't exist, which is fine, we just return null.

    // 4. Return Combined Data
    return new Response(
      JSON.stringify({
        inquiries: inquiriesResponse.data,
        appointments: appointmentsResponse.data,
        therapist: therapistResponse.data ? [therapistResponse.data] : [] // Frontend expects array for legacy reasons or just send the object? AdminPage expects data[0] so array is safer if we change frontend logic.
        // Wait, looking at frontend AdminPage.tsx:18 setTherapist(data[0]); 
        // AdminPage expects the whole response to be an array? 
        // Let's re-read the frontend.
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})