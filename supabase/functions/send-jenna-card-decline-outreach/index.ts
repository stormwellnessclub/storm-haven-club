// One-off outreach email to Jenna Bloom regarding repeated card-update declines.
// Idempotent: gated by a hardcoded token to prevent accidental re-sends.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONE_SHOT_TOKEN = "jenna-card-2026-07-10";

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
        <h2 style="color:#1C170F;margin-top:0;font-family:Georgia,serif;font-weight:500;">Trouble saving your card on file</h2>
        <p>Hi Jenna,</p>
        <p>We noticed you tried to update your card on file in your member portal, and both attempts were declined by your bank — not by us. Here's what your issuing bank returned:</p>
        <div style="background:#F0DFC4;border:1px solid #C1B19C;border-radius:8px;padding:20px;margin:25px 0;">
          <p style="margin:0 0 10px 0;color:#1C170F;"><strong>Attempt 1:</strong> "Your card does not support this type of purchase."</p>
          <p style="margin:0;color:#1C170F;"><strong>Attempt 2:</strong> "Your card has been declined."</p>
        </div>
        <p>This almost always means your bank is blocking <strong>card-on-file / recurring merchant authorizations</strong>, which we need in order to save the card for your monthly membership. It's a control on the bank's side that we're not able to override.</p>
        <p style="color:#1C170F;font-weight:600;margin-bottom:6px;">A few things that usually clear it up:</p>
        <ol style="padding-left:20px;line-height:1.7;">
          <li><strong>Call the number on the back of your card</strong> and ask them to authorize recurring / card-on-file purchases with <em>Storm Wellness Club</em>, then try again.</li>
          <li><strong>Try a different card</strong> — a different Visa/Mastercard or a debit card often goes through immediately.</li>
          <li><strong>Try Apple Pay or Google Pay</strong> in the card form — those sometimes bypass the block entirely.</li>
        </ol>
        <div style="text-align:center;margin:30px 0;">
          <a href="${BASE_URL}/member/payment-methods" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;font-family:Georgia,serif;letter-spacing:0.5px;">Update Card in Portal</a>
        </div>
        <p>If none of those work, just reply to this email and we'll help you sort it out personally — no rush and no worries.</p>
        <p style="margin:30px 0 5px 0;color:#1C170F;">Thanks so much,<br/>— The Storm Wellness Club Team</p>
      </div>
      ${footer}
    </div>
  `;

  const emailResponse = await resend.emails.send({
    from: 'Storm Wellness Club <admin@stormwellnessclub.com>',
    to: ['jennaalameedi@gmail.com'],
    subject: 'Storm Wellness Club — Trouble updating your card on file',
    html,
    reply_to: 'admin@stormwellnessclub.com',
  });

  return new Response(JSON.stringify({ ok: true, resend: emailResponse }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
