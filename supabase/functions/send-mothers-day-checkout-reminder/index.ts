// Sends a friendly "finish your checkout" email to buyers whose Mother's Day
// voucher is still in `pending` status (started checkout but never paid).
//
// Body: { voucher_id: string }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";

function shell(inner: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#e9e0d2;font-family:'Cormorant Garamond',Georgia,serif;color:#6b5a3b;">
<div style="max-width:600px;margin:0 auto;background:#ece2d2;padding:48px 32px;text-align:center;">
  <div style="font-family:Georgia,serif;font-size:48px;letter-spacing:2px;color:#a17e3a;font-weight:700;">aella</div>
  <div style="font-size:11px;letter-spacing:6px;color:#a17e3a;margin-bottom:24px;">STORM WELLNESS CLUB</div>
  ${inner}
  <p style="font-size:11px;color:#8a6d3b;margin-top:32px;letter-spacing:2px;">stormwellnessclub.com</p>
</div></body></html>`;
}

function buildHtml(v: any) {
  const giftLine = v.recipient_name
    ? `<p style="font-size:16px;color:#6b5a3b;margin:0 0 18px;">Your gift for <strong>${v.recipient_name}</strong> is just one step away.</p>`
    : `<p style="font-size:16px;color:#6b5a3b;margin:0 0 18px;">Your Mother's Day gift is just one step away.</p>`;
  const inner = `
  <h1 style="font-size:34px;color:#a17e3a;margin:8px 0 6px;font-weight:500;font-style:italic;">Finish your checkout</h1>
  ${giftLine}

  <div style="margin:8px 0 24px;padding:24px;background:#fff;border:2px dashed #c9a86a;border-radius:8px;">
    <p style="font-size:12px;letter-spacing:4px;color:#a17e3a;margin:0 0 6px;">MOTHER'S DAY SPECIAL</p>
    <p style="font-size:22px;color:#1c170f;margin:6px 0 4px;font-weight:600;">${v.massage_choice || "Custom Massage"}</p>
    <p style="font-size:14px;color:#6b5a3b;margin:0 0 10px;">${v.massage_duration || 60} min · + Wet Spa Access</p>
  </div>

  <p style="font-size:15px;color:#6b5a3b;margin:0 0 22px;line-height:1.5;">
    We noticed your checkout didn't quite go through. The offer is still available — tap below to finish and we'll send your voucher right away.
  </p>

  <a href="${SITE}/mothers-day" style="display:inline-block;padding:14px 32px;background:#a17e3a;color:#fff;text-decoration:none;font-size:14px;letter-spacing:3px;border-radius:4px;font-weight:600;">FINISH MY PURCHASE</a>

  <p style="font-size:12px;color:#8a6d3b;margin-top:28px;">Questions? Just reply to this email — we're happy to help.</p>
  `;
  return shell(inner);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { voucher_id, preview } = await req.json();
    if (!voucher_id) {
      return new Response(JSON.stringify({ error: "voucher_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: v, error } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("id", voucher_id)
      .maybeSingle();

    if (error || !v) {
      return new Response(JSON.stringify({ error: "Voucher not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (v.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Voucher status is "${v.status}" — reminder only valid for pending.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!v.buyer_email) {
      return new Response(JSON.stringify({ error: "Voucher has no buyer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Throttle: don't send more than once per hour
    if (v.last_reminder_sent_at) {
      const last = new Date(v.last_reminder_sent_at).getTime();
      if (Date.now() - last < 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({ error: "A reminder was sent less than an hour ago. Please wait." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resend = new Resend(resendKey);

    const html = buildHtml(v);
    const subject = "Finish your Mother's Day gift — your checkout is waiting";

    const sendRes = await resend.emails.send({
      from: FROM,
      to: [v.buyer_email],
      subject,
      html,
    });

    if ((sendRes as any).error) {
      return new Response(
        JSON.stringify({ error: (sendRes as any).error?.message || "Failed to send" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("mothers_day_vouchers")
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq("id", voucher_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
