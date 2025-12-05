import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Initialize Supabase Client
    // We create the client specifically to validate the user's session
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 2. Authenticate User
    // Get the JWT token from the Authorization header [cite: 213]
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

    // 3. Fetch Data [cite: 217]
    // We can use Promise.all to fetch both tables in parallel for speed
    const [inquiriesResponse, appointmentsResponse] = await Promise.all([
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
        .order('start_time', { ascending: false })
    ])

    if (inquiriesResponse.error) throw inquiriesResponse.error
    if (appointmentsResponse.error) throw appointmentsResponse.error

    // 4. Return Combined Data [cite: 218]
    return new Response(
      JSON.stringify({
        inquiries: inquiriesResponse.data,
        appointments: appointmentsResponse.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})