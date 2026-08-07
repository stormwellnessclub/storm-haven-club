import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;



  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find guests who checked in yesterday, have an email, and haven't received feedback yet
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: eligibleGuests, error: fetchError } = await supabase
      .from('guest_passes')
      .select('id, guest_name, guest_email, used_at, valid_date')
      .eq('status', 'exhausted')
      .not('guest_email', 'is', null)
      .is('feedback_email_sent_at', null)
      .or(`no_show.is.null,no_show.eq.false`);

    if (fetchError) {
      console.error('Error fetching eligible guests:', fetchError);
      throw fetchError;
    }

    // Filter to guests who were checked in yesterday (used_at date = yesterday)
    const yesterdayGuests = (eligibleGuests || []).filter(g => {
      if (!g.used_at) return false;
      const usedDate = g.used_at.split('T')[0];
      return usedDate === yesterdayStr;
    });

    console.log(`Found ${yesterdayGuests.length} guests eligible for feedback email`);

    let sent = 0;
    let errors = 0;

    for (const guest of yesterdayGuests) {
      try {
        // Generate a unique feedback token based on guest pass ID
        const feedbackToken = `fb-${guest.id}`;

        // Format visit date for the email
        const visitDate = guest.valid_date 
          ? new Date(guest.valid_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : undefined;

        const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://stormwellnessclub.com';
        const feedbackUrl = `${appBaseUrl}/guest-feedback?token=${feedbackToken}`;

        // Send the feedback email
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'guest_visit_feedback',
            to: guest.guest_email,
            data: {
              name: guest.guest_name,
              visitDate,
              feedbackToken,
              feedbackUrl,
              source: 'process-guest-feedback-emails',
            },
          },
        });

        if (emailError) {
          console.error(`Failed to send feedback email to ${guest.guest_email}:`, emailError);
          errors++;
          continue;
        }

        // Stamp feedback_email_sent_at
        const { error: updateError } = await supabase
          .from('guest_passes')
          .update({ feedback_email_sent_at: new Date().toISOString() })
          .eq('id', guest.id);

        if (updateError) {
          console.error(`Failed to update feedback_email_sent_at for ${guest.id}:`, updateError);
          errors++;
          continue;
        }

        sent++;
        console.log(`Feedback email sent to ${guest.guest_email}`);
      } catch (err) {
        console.error(`Error processing guest ${guest.id}:`, err);
        errors++;
      }
    }

    const result = { sent, errors, eligible: yesterdayGuests.length };
    console.log('Processing complete:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in process-guest-feedback-emails:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
