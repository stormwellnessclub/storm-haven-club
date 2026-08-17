import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireStaff } from "../_shared/requireStaff.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://stormwellnessclub.com';

const emailStyles = {
  container: 'font-family: Georgia, "Times New Roman", Times, serif; max-width: 600px; margin: 0 auto; padding: 0;',
  header: 'background: #DEDACE; padding: 40px 30px; text-align: center;',
  content: 'background: #ffffff; padding: 30px; border-left: 1px solid #C1B19C; border-right: 1px solid #C1B19C;',
  footer: 'background: #1C170F; padding: 25px; text-align: center; color: #DEDACE;',
  button: 'display: inline-block; background: #1C170F; color: #DEDACE; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: Georgia, serif; letter-spacing: 0.5px; margin: 10px 5px;',
  heading: 'color: #1C170F; margin-top: 0; font-family: Georgia, serif; font-weight: 500;',
  muted: 'color: #88766B; font-size: 14px; font-family: Georgia, serif;',
  infoBox: 'background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { email, name, cardSetupAttemptId } = await req.json();

    if (!email || !name) {
      throw new Error('Missing required fields: email, name');
    }

    const firstName = name.split(' ')[0] || name;

    // Send reminder email
    const { error: emailError } = await resend.emails.send({
      from: 'Storm Wellness Club <membership@stormwellnessclub.com>',
      to: email,
      subject: 'Complete Your Storm Wellness Club Application',
      html: `
        <div style="${emailStyles.container}">
          <div style="${emailStyles.header}">
            <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display: block; margin: 0 auto;" />
          </div>
          <div style="height: 4px; background: linear-gradient(90deg, #B8A068, #C1B19C, #B8A068);"></div>
          <div style="${emailStyles.content}">
            <h2 style="${emailStyles.heading}">Hi ${firstName},</h2>
            <p>We noticed you started a membership application with Storm Wellness Club but didn't finish submitting it.</p>
            <p>Your spot is still available! Complete your application to join our exclusive wellness community.</p>
            <div style="${emailStyles.infoBox}">
              <p style="margin: 0; font-weight: 500;">What you'll get as a member:</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Access to premium fitness equipment & classes</li>
                <li>Spa & wellness services</li>
                <li>Exclusive member events & community</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/apply" style="${emailStyles.button}">Complete Your Application</a>
            </div>
            <p style="${emailStyles.muted}">If you have any questions, feel free to reach out to our membership team.</p>
          </div>
          <div style="height: 1px; background: #C1B19C;"></div>
          <div style="${emailStyles.footer}">
            <p style="${emailStyles.muted}">
              Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send reminder email:', emailError);
      throw new Error(`Failed to send email: ${JSON.stringify(emailError)}`);
    }

    // Update card_setup_attempts with reminder tracking
    if (cardSetupAttemptId) {
      // Fetch current count and increment
      const { data: current } = await supabase
        .from('card_setup_attempts')
        .select('reminder_count')
        .eq('id', cardSetupAttemptId)
        .single();

      await supabase
        .from('card_setup_attempts')
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_count: (current?.reminder_count || 0) + 1,
        })
        .eq('id', cardSetupAttemptId);
    }

    // Log to email audit
    try {
      await supabase.from('email_audit_log').insert({
        email_type: 'application_reminder',
        recipient_email: email,
        recipient_name: name,
        trigger_source: 'admin_manual',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Failed to log email audit:', auditErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-application-reminder error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
