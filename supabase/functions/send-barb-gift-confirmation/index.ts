// One-off confirmation email to Barb Kovach: her gift to Melody Nichols was delivered.
// Gated by a hardcoded one-shot token to prevent accidental re-sends.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONE_SHOT_TOKEN = "barb-gift-2026-08-19";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get('token') !== ONE_SHOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
  const BASE_URL = 'https://stormwellnessclub.com';

  const html = `
  <div style="font-family: Georgia, 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 0;">
    <div style="background: #DEDACE; padding: 40px 30px; text-align: center;">
      <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display: block; margin: 0 auto;" />
    </div>
    <div style="height: 4px; background: linear-gradient(90deg, #B8A068, #C1B19C, #B8A068);"></div>
    <div style="background: #ffffff; padding: 30px; border-left: 1px solid #C1B19C; border-right: 1px solid #C1B19C;">
      <h2 style="color: #1C170F; margin-top: 0; font-family: Georgia, serif; font-weight: 500;">Your gift has been delivered</h2>
      <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">Hi Barb,</p>
      <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
        Your gift for <strong>Melody Nichols</strong> has been sent. She received it by email at
        <strong>melodynicholssong@icloud.com</strong> on <strong>August 19, 2026</strong>, along with your birthday note.
      </p>
      <div style="border: 1px solid #E6DED2; border-radius: 10px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; font-size: 15px; color: #374151;">
          <tr><td style="padding: 6px 0; color: #88766B;">Gift</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">3 Ozone Sauna Sessions</td></tr>
          <tr><td style="padding: 6px 0; color: #88766B;">Recipient</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">Melody Nichols (melodynicholssong@icloud.com)</td></tr>
          <tr><td style="padding: 6px 0; color: #88766B;">Gift code</td><td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: 700;">STORM-TKE5-49J4</td></tr>
          <tr><td style="padding: 6px 0; color: #88766B;">Delivery</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">Sent August 19, 2026</td></tr>
          <tr><td style="padding: 6px 0; color: #88766B;">Valid through</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">August 19, 2027</td></tr>
          <tr><td style="padding: 6px 0; color: #88766B;">Payment</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">Received — thank you</td></tr>
        </table>
      </div>
      <div style="background: #FFF8E7; border-left: 4px solid #C1B19C; padding: 18px 20px; border-radius: 6px; margin: 24px 0;">
        <div style="font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #88766B; margin-bottom: 8px;">The note we included</div>
        <div style="color: #1C170F; font-size: 16px; line-height: 1.7; font-style: italic;">"Happy Birthday, Dear Melody!!! This gift represents his multiplication of the double portion, including his healing. So happy you are here in the wellness storm. Love you high low always, Barb and Tim."</div>
      </div>
      <p style="font-size: 15px; line-height: 1.8; color: #374151;">
        Melody can simply give her code to the front desk and we'll take care of scheduling her sessions.
        If she doesn't see the email, it's worth checking her spam or promotions folder — and we're happy to resend it any time.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${BASE_URL}" style="display: inline-block; background: #1C170F; color: #DEDACE; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: Georgia, serif; letter-spacing: 0.5px;">Visit Storm Wellness Club</a>
      </div>
      <p style="margin: 30px 0 5px 0; color: #1C170F;">Thank you for such a thoughtful gift,</p>
      <p style="font-weight: 600; color: #1f2937; margin: 0;">— The Storm Wellness Club Team</p>
    </div>
    <div style="height: 1px; background: #C1B19C;"></div>
    <div style="background: #1C170F; padding: 25px; text-align: center; color: #DEDACE;">
      <p style="color: #88766B; font-size: 12px; margin: 0; font-family: Georgia, serif;">
        Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
      </p>
    </div>
  </div>`;

  const emailResponse = await resend.emails.send({
    from: 'Storm Wellness Club <admin@stormwellnessclub.com>',
    to: ['bjkd@sbcglobal.net'],
    subject: 'Your gift has been delivered to Melody',
    html,
    reply_to: 'admin@stormwellnessclub.com',
  });

  return new Response(JSON.stringify({ ok: true, resend: emailResponse }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
  });
});
