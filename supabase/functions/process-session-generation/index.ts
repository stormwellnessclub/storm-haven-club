import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body for optional parameters
    let weeksAhead = 4
    let startDate = new Date().toISOString().split('T')[0]
    
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        if (body.weeks_ahead) {
          weeksAhead = Math.min(Math.max(1, body.weeks_ahead), 12) // Limit between 1-12 weeks
        }
        if (body.start_date) {
          startDate = body.start_date
        }
      } catch {
        // Use defaults if body parsing fails
      }
    }

    console.log(`Generating class sessions: start_date=${startDate}, weeks_ahead=${weeksAhead}`)

    // Call the database function to generate sessions
    const { data, error } = await supabase.rpc('generate_class_sessions', {
      _start_date: startDate,
      _weeks_ahead: weeksAhead
    })

    if (error) {
      console.error('Error generating sessions:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = data?.[0] || { sessions_created: 0, sessions_skipped: 0 }
    
    console.log(`Session generation complete: created=${result.sessions_created}, skipped=${result.sessions_skipped}`)

    return new Response(
      JSON.stringify({
        success: true,
        sessions_created: result.sessions_created,
        sessions_skipped: result.sessions_skipped,
        start_date: startDate,
        weeks_ahead: weeksAhead,
        generated_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
