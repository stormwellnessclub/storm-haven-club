import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://stormwellnessclub.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName } = await req.json();

    if (!email || !firstName) {
      return new Response(
        JSON.stringify({ error: "Missing email or firstName" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if application was already submitted (not pending_payment)
    const { data: existingApp } = await supabaseAdmin
      .from('membership_applications')
      .select('id, status')
      .ilike('email', email)
      .neq('status', 'pending_payment')
      .limit(1)
      .maybeSingle();

    if (existingApp) {
      console.log(`[Abandon] Application already submitted for ${email}, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'already_submitted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we already sent an abandoned email for this address
    const { data: existingAudit } = await supabaseAdmin
      .from('email_audit_log')
      .select('id')
      .eq('email_type', 'abandoned_application')
      .ilike('recipient_email', email)
      .limit(1)
      .maybeSingle();

    if (existingAudit) {
      console.log(`[Abandon] Already sent recovery email to ${email}, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'already_sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send the abandoned application email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    const subject = 'Did something come up? — Storm Wellness Club';
    const html = `
      <div style="font-family: Georgia, 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 0;">
        <div style="background: #DEDACE; padding: 40px 30px; text-align: center;">
          <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display: block; margin: 0 auto;" />
        </div>
        <div style="height: 4px; background: linear-gradient(90deg, #B8A068, #C1B19C, #B8A068);"></div>
        <div style="background: #ffffff; padding: 30px; border-left: 1px solid #C1B19C; border-right: 1px solid #C1B19C;">
          <h2 style="color: #1C170F; margin-top: 0; font-family: Georgia, serif; font-weight: 500;">Hi ${firstName},</h2>
          <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
            We noticed you started an application for Storm Wellness Club but didn't finish — no worries at all.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
            If you had any questions or something gave you pause, I'm happy to answer personally. Just reply to this email.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
            Your application is saved and ready whenever you are.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${BASE_URL}/apply" style="display: inline-block; background: #1C170F; color: #DEDACE; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: Georgia, serif; letter-spacing: 0.5px;">Continue Your Application</a>
          </div>
          <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 5px;">
            Talk soon,
          </p>
          <p style="font-size: 16px; font-weight: 600; color: #1C170F; margin-bottom: 0;">
            The Storm Wellness Club Team
          </p>
        </div>
        <div style="background: #1C170F; padding: 25px; text-align: center;">
          <p style="color: #88766B; font-size: 12px; margin: 0; font-family: Georgia, serif;">
            Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: 'Storm Wellness Club <membership@stormwellnessclub.com>',
      to: [email],
      subject,
      html,
    });

    console.log("[Abandon] Recovery email sent:", emailResponse);

    // Log to email_audit_log
    await supabaseAdmin.from('email_audit_log').insert({
      email_type: 'abandoned_application',
      recipient_email: email,
      recipient_name: firstName,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      trigger_source: 'send-abandoned-application',
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error("[Abandon] Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
