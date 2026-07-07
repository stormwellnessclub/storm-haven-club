// One-off outreach email to Amal Berry regarding unpaid acai bowl balance.
// Idempotent: safeguarded by a hardcoded token check to prevent accidental re-sends.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONE_SHOT_TOKEN = "amal-acai-2026-07-07";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (token !== ONE_SHOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
  const BASE_URL = 'https://stormwellnessclub.com';

  const header = `
    <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
      <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display:block;margin:0 auto;" />
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
  `;
  const footer = `
    <div style="background:#1C170F;padding:25px;text-align:center;color:#DEDACE;font-family:Georgia,serif;font-size:13px;">
      <p style="margin:0 0 6px 0;">Storm Wellness Club</p>
      <p style="margin:0;">Reply to this email or contact <a href="mailto:admin@stormwellnessclub.com" style="color:#DEDACE;">admin@stormwellnessclub.com</a></p>
    </div>
  `;

  const html = `
    <div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
      ${header}
      <div style="background:#ffffff;padding:30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;">
        <h2 style="color:#1C170F;margin-top:0;font-family:Georgia,serif;font-weight:500;">A quick note about your recent acai bowl</h2>
        <p>Hi Amal,</p>
        <p>We hope you enjoyed your acai bowl from the Storm Cafe. Unfortunately, the card we attempted to charge for that order has continued to decline, and we haven't been able to reach you through our other attempts to follow up.</p>
        <div style="background:#F0DFC4;border:1px solid #C1B19C;border-radius:8px;padding:20px;margin:25px 0;">
          <p style="margin:0 0 8px 0;color:#1C170F;"><strong>Outstanding balance: $27.60</strong></p>
          <p style="margin:0;color:#88766B;font-size:14px;font-family:Georgia,serif;">$25.00 acai bowl + $1.50 MI sales tax + $1.10 processing fee</p>
        </div>
        <p>To settle it in one click, please use the secure payment link below:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://buy.stripe.com/00w3cw1GB7CP6AK2fV4F202" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;font-family:Georgia,serif;letter-spacing:0.5px;">Pay $27.60</a>
        </div>
        <p style="color:#88766B;font-size:14px;">The link opens a secure Stripe checkout that works on your phone or desktop — no login required.</p>
        <p>If you believe this is a mistake, or you'd prefer to update your card and have us re-run it, just reply to this email or stop by the front desk and we'll take care of it.</p>
        <p style="margin:30px 0 5px 0;color:#1C170F;">Thanks for being part of the club,<br/>— The Storm Wellness Club Team</p>
      </div>
      ${footer}
    </div>
  `;

  const emailResponse = await resend.emails.send({
    from: 'Storm Wellness Club <admin@stormwellnessclub.com>',
    to: ['amalberry.03@gmail.com'],
    subject: 'Storm Cafe — Payment Issue on Your Recent Acai Bowl',
    html,
    reply_to: 'admin@stormwellnessclub.com',
  });

  return new Response(JSON.stringify({ ok: true, resend: emailResponse }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
