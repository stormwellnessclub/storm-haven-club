import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing expired waitlist notifications...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find expired waitlist notifications
    const { data: expiredEntries, error: fetchError } = await supabase
      .from('class_waitlist')
      .select('id, session_id, user_id')
      .eq('status', 'notified')
      .lt('claim_expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired entries:', fetchError);
      throw fetchError;
    }

    if (!expiredEntries || expiredEntries.length === 0) {
      console.log('No expired waitlist notifications found');
      return new Response(
        JSON.stringify({ message: 'No expired notifications to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredEntries.length} expired waitlist notification(s)`);

    const processedSessions: string[] = [];

    for (const entry of expiredEntries) {
      console.log(`Processing expired entry ${entry.id} for session ${entry.session_id}`);

      // Mark as expired
      const { error: updateError } = await supabase
        .from('class_waitlist')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`Error updating entry ${entry.id}:`, updateError);
        continue;
      }

      console.log(`Marked entry ${entry.id} as expired`);

      // Notify next person in queue (only once per session)
      if (!processedSessions.includes(entry.session_id)) {
        console.log(`Invoking notify-waitlist for session ${entry.session_id}`);
        
        const { error: invokeError } = await supabase.functions.invoke('notify-waitlist', {
          body: { session_id: entry.session_id }
        });

        if (invokeError) {
          console.error(`Error invoking notify-waitlist for session ${entry.session_id}:`, invokeError);
        } else {
          console.log(`Successfully notified next person for session ${entry.session_id}`);
          processedSessions.push(entry.session_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Expired notifications processed',
        processed: expiredEntries.length,
        sessionsNotified: processedSessions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-expired-waitlist:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
