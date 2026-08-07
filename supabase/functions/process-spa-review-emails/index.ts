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
    const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://stormwellnessclub.com';

    // Find tokens that:
    //  - haven't had an email sent
    //  - have a recipient email
    //  - the appointment completed at least 30 min ago
    //  - aren't already used or expired
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: tokens, error } = await supabase
      .from('spa_review_tokens')
      .select('token, appointment_id, recipient_email, recipient_name, service_name, appointment_date')
      .is('email_sent_at', null)
      .is('used_at', null)
      .not('recipient_email', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .limit(100);

    if (error) throw error;

    // Cross-check completed_at >= 30 min ago
    let eligible: any[] = [];
    if (tokens && tokens.length > 0) {
      const ids = tokens.map(t => t.appointment_id);
      const { data: appts } = await supabase
        .from('spa_appointments')
        .select('id, completed_at, status')
        .in('id', ids);
      const apptMap = new Map((appts || []).map(a => [a.id, a]));
      eligible = tokens.filter(t => {
        const a = apptMap.get(t.appointment_id);
        return a && a.status === 'completed' && a.completed_at && a.completed_at < cutoff;
      });
    }

    let sent = 0, errors = 0;
    for (const t of eligible) {
      try {
        const visitDate = t.appointment_date
          ? new Date(t.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : undefined;
        const reviewUrl = `${appBaseUrl}/review/spa/${t.token}`;

        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'spa_review_request',
            to: t.recipient_email,
            data: {
              name: t.recipient_name,
              serviceName: t.service_name,
              visitDate,
              token: t.token,
              reviewUrl,
              source: 'process-spa-review-emails',
            },
          },
        });

        if (emailError) {
          console.error(`Failed to send spa review email for token ${t.token}:`, emailError);
          errors++;
          continue;
        }

        await supabase
          .from('spa_review_tokens')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('token', t.token);

        sent++;
      } catch (err) {
        console.error(`Error processing token ${t.token}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, eligible: eligible.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in process-spa-review-emails:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
