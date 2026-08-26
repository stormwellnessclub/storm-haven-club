// Sends Mother's Day Class Pack confirmation emails — buyer receipt and (if gift) recipient email.
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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function buyerReceiptHtml(opts: {
  buyerName: string;
  isGift: boolean;
  recipientName: string | null;
  expiresAt: string;
  tier: "member" | "nonMember";
  pricePaid: number;
}) {
  const tierLabel = opts.tier === "member" ? "Member ($150)" : "Non-Member ($265)";
  const giftLine = opts.isGift && opts.recipientName
    ? `<p style="margin:0 0 12px;color:#6b5a3b;">Gifted to <strong>${opts.recipientName}</strong></p>`
    : "";
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:30px;margin:0 0 18px;">Thank you, ${opts.buyerName}!</h1>
      <p style="margin:0 0 16px;">Your <strong>Mother's Day Class Pack</strong> purchase is confirmed.</p>
      ${giftLine}
      <table style="width:100%;border-collapse:collapse;margin:18px 0 22px;">
        <tr><td style="padding:6px 0;color:#6b5a3b;">Pass</td><td style="padding:6px 0;text-align:right;">10 Studio Classes</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Pricing tier</td><td style="padding:6px 0;text-align:right;">${tierLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Valid until</td><td style="padding:6px 0;text-align:right;">${fmtDate(opts.expiresAt)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Amount paid</td><td style="padding:6px 0;text-align:right;">$${opts.pricePaid.toFixed(2)}</td></tr>
      </table>
      <p style="margin:0 0 12px;font-size:14px;color:#6b5a3b;">
        ${opts.isGift
          ? "We've sent a separate email to the recipient with everything they need to start booking."
          : "Use your pass on the schedule page to book Reformer, Cycling, and other studio classes."}
      </p>
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${SITE}/schedule" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">View Schedule</a>
      </p>
      <p style="font-size:12px;color:#8a7a5a;margin:28px 0 0;text-align:center;">
        Pass valid for 2 months from purchase. Storm Wellness Club, Livonia, MI.
      </p>
    </div>
  </div>`;
}

function recipientGiftHtml(opts: {
  buyerName: string;
  recipientName: string;
  recipientEmail: string;
  expiresAt: string;
}) {
  const redeemUrl = `${SITE}/mothers-day-pack-redeem?email=${encodeURIComponent(opts.recipientEmail)}`;
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">A GIFT FROM ${opts.buyerName.toUpperCase()}</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:30px;margin:0 0 18px;">Happy Mother's Day, ${opts.recipientName}</h1>
      <p style="margin:0 0 14px;font-size:16px;">
        ${opts.buyerName} has gifted you a <strong>10-Class Pack</strong> at Storm Wellness Club —
        good for Reformer Pilates, Cycling, and other studio classes.
      </p>
      <p style="margin:0 0 18px;color:#6b5a3b;">Valid through <strong>${fmtDate(opts.expiresAt)}</strong>.</p>
      <p style="text-align:center;margin:28px 0 14px;">
        <a href="${redeemUrl}" style="background:#a17e3a;color:#fff;padding:14px 32px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">Claim Your Gift</a>
      </p>
      <p style="font-size:13px;color:#6b5a3b;text-align:center;margin:0 0 4px;">
        New to Storm Wellness Club? Create a free account using <strong>this email address</strong> — your pass will be linked automatically.
      </p>
      <p style="font-size:12px;color:#8a7a5a;margin:24px 0 0;text-align:center;">
        Storm Wellness Club &middot; Livonia, MI
      </p>
    </div>
  </div>`;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

async function send(to: string, subject: string, html: string) {
  const r = await resend.emails.send({ from: FROM, to: [to], subject, html });
  if ((r as any).error) throw new Error((r as any).error.message || "send failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pass_id } = await req.json();
    if (!pass_id) throw new Error("pass_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: pass, error } = await supabase
      .from("class_passes")
      .select("*")
      .eq("id", pass_id)
      .single();
    if (error) throw error;

    const isGift = !!pass.gift_recipient_email;
    const tier = pass.is_member_price ? "member" : "nonMember";
    const buyerEmail = pass.gift_buyer_email;
    const buyerName = pass.gift_buyer_name || "";
    const recipName = pass.gift_recipient_name || "";

    if (buyerEmail) {
      await send(
        buyerEmail,
        isGift ? "Your Mother's Day Class Pack gift is confirmed" : "Your Mother's Day Class Pack is confirmed",
        buyerReceiptHtml({
          buyerName,
          isGift,
          recipientName: recipName || null,
          expiresAt: pass.expires_at,
          tier,
          pricePaid: Number(pass.price_paid),
        })
      );
    }

    if (isGift && pass.gift_recipient_email) {
      await send(
        pass.gift_recipient_email,
        `${buyerName || "A friend"} sent you a Mother's Day gift`,
        recipientGiftHtml({
          buyerName: buyerName || "A friend",
          recipientName: recipName || "there",
          recipientEmail: pass.gift_recipient_email,
          expiresAt: pass.expires_at,
        })
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
