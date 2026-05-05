import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function buildHtml(v: any) {
  const recipient = v.recipient_name || v.buyer_name;
  const giftLine = v.recipient_name
    ? `<p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; color: #8a6d3b; margin: 24px 0 8px;">To: <strong>${v.recipient_name}</strong></p>
       <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; color: #8a6d3b; margin: 0 0 8px;">From: <strong>${v.buyer_name}</strong></p>
       ${v.gift_message ? `<p style="font-style: italic; color: #6b5a3b; margin-top: 16px;">"${v.gift_message}"</p>` : ""}`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#e9e0d2;">
<div style="max-width:560px;margin:0 auto;background:#ece2d2;padding:48px 32px;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;color:#6b5a3b;">
  <div style="font-family:Georgia,serif;font-size:48px;letter-spacing:2px;color:#a17e3a;font-weight:700;">aella</div>
  <div style="font-size:11px;letter-spacing:6px;color:#a17e3a;margin-bottom:32px;">STORM WELLNESS CLUB</div>
  <h1 style="font-size:36px;color:#a17e3a;margin:0 0 16px;font-weight:500;">Mother's Day Special</h1>
  <p style="font-size:20px;color:#a17e3a;margin:24px 0 8px;font-weight:600;">${v.massage_choice}</p>
  <p style="color:#a17e3a;margin:0 0 16px;">+</p>
  <p style="font-size:18px;color:#a17e3a;margin:0 0 8px;font-weight:600;">Exclusive Wet Spa Access:</p>
  <p style="font-size:16px;color:#8a6d3b;margin:0;">• Sauna &nbsp;•&nbsp; Steam &nbsp;•&nbsp; Himalayan Salt Room</p>
  ${giftLine}
  <div style="margin:36px 0 16px;padding:24px;background:#fff;border:2px dashed #c9a86a;border-radius:8px;">
    <div style="font-size:12px;letter-spacing:3px;color:#a17e3a;">VOUCHER CODE</div>
    <div style="font-family:monospace;font-size:28px;letter-spacing:4px;color:#1c170f;margin-top:8px;">${v.code}</div>
  </div>
  <p style="font-size:14px;color:#6b5a3b;">Redeemable through <strong>${fmtDate(v.expires_at)}</strong></p>
  <p style="font-size:14px;color:#6b5a3b;margin-top:20px;">Book at <a href="https://stormwellnessclub.com/spa" style="color:#a17e3a;">stormwellnessclub.com</a> or call us. Mention your code at checkout.</p>
  <p style="font-family:cursive;font-size:28px;color:#a17e3a;margin-top:32px;">Happy Mother's Day</p>
  <p style="font-size:11px;color:#8a6d3b;margin-top:24px;">Stormwellnessclub.com</p>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { voucher_id } = await req.json();
    const { data: v } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("id", voucher_id)
      .single();
    if (!v) throw new Error("Voucher not found");

    const html = buildHtml(v);
    const subject = v.recipient_name
      ? `${v.buyer_name} sent you a Mother's Day gift 💛`
      : "Your Mother's Day Special voucher";

    const recipients = v.recipient_email
      ? [v.recipient_email, v.buyer_email]
      : [v.buyer_email];

    await resend.emails.send({ from: FROM, to: recipients, subject, html });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
