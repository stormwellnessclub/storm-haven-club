// Sends Mother's Day voucher emails.
// - Gift purchase: sends a "gift card" style email to the recipient (from buyer)
//   AND a separate receipt to the buyer. Each is sent independently so a bounce
//   on one doesn't block the other.
// - Self purchase: sends a single receipt to the buyer.
// Every send attempt is logged to mothers_day_voucher_emails for admin visibility
// and per-recipient resend.
//
// Body: { voucher_id: string, only?: 'recipient' | 'buyer' | 'self', triggered_by?: string }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------- Shared shell ----------
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

// ---------- Gift email — for the recipient ----------
function buildGiftHtml(v: any) {
  const inner = `
  <h1 style="font-size:38px;color:#a17e3a;margin:8px 0 4px;font-weight:500;font-style:italic;">A Gift For You</h1>
  <p style="font-size:18px;color:#8a6d3b;margin:0 0 28px;">from <strong>${v.buyer_name}</strong></p>

  <div style="margin:8px 0 28px;padding:28px 24px;background:#fff;border:2px dashed #c9a86a;border-radius:8px;">
    <p style="font-size:14px;letter-spacing:4px;color:#a17e3a;margin:0 0 6px;">MOTHER'S DAY SPECIAL</p>
    <p style="font-size:24px;color:#1c170f;margin:6px 0 4px;font-weight:600;">${v.massage_choice}</p>
    <p style="font-size:14px;color:#6b5a3b;margin:0 0 14px;">${v.massage_duration} min</p>
    <p style="font-size:14px;color:#a17e3a;margin:0 0 4px;font-weight:600;">+ Exclusive Wet Spa Access</p>
    <p style="font-size:13px;color:#8a6d3b;margin:0;">Sauna · Steam · Himalayan Salt Room</p>
  </div>

  <div style="margin:8px 0 24px;padding:20px;background:#fdfaf3;border:1px solid #c9a86a;border-radius:6px;">
    <div style="font-size:11px;letter-spacing:3px;color:#a17e3a;">YOUR VOUCHER CODE</div>
    <div style="font-family:monospace;font-size:30px;letter-spacing:5px;color:#1c170f;margin-top:6px;">${v.code}</div>
  </div>

  ${
    v.gift_message
      ? `<div style="margin:24px 0;padding:18px 24px;background:#fff;border-left:3px solid #c9a86a;text-align:left;">
           <p style="font-style:italic;color:#6b5a3b;margin:0;font-size:16px;">"${v.gift_message}"</p>
           <p style="margin:10px 0 0;font-size:13px;color:#8a6d3b;text-align:right;">— ${v.buyer_name}</p>
         </div>`
      : ""
  }

  <div style="margin:28px 0;padding:18px;background:transparent;text-align:left;">
    <p style="font-size:14px;color:#6b5a3b;margin:0 0 10px;font-weight:600;letter-spacing:1px;">HOW TO REDEEM</p>
    <ol style="font-size:14px;color:#6b5a3b;margin:0;padding-left:18px;line-height:1.7;">
      <li>Click the button below to redeem online, or call us to book.</li>
      <li>Mention your code at check-in if booking by phone.</li>
    </ol>
  </div>

  <p style="font-size:13px;color:#a17e3a;margin:0 0 16px;font-weight:600;letter-spacing:1px;">
    ★ SAVE THIS CODE — you'll need it at check-in
  </p>

  <a href="${SITE}/auth?mode=signup&voucher=${encodeURIComponent(v.code)}&redirect=${encodeURIComponent(`/mothers-day/redeem?code=${v.code}`)}"
     style="display:inline-block;background:#a17e3a;color:#fff;padding:14px 32px;border-radius:4px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:14px;margin:8px 0;">
    CLAIM &amp; SAVE YOUR GIFT
  </a>

  <p style="font-size:12px;color:#6b5a3b;margin:10px 0 0;">
    Already have an account?
    <a href="${SITE}/auth?mode=signin&redirect=${encodeURIComponent(`/mothers-day/redeem?code=${v.code}`)}" style="color:#a17e3a;text-decoration:underline;">Sign in</a>
  </p>

  <p style="font-size:13px;color:#6b5a3b;margin-top:18px;">
    Be sure to <strong>save this code</strong> — screenshot this email or write it down. You'll need it at check-in.
  </p>


  <p style="font-size:13px;color:#6b5a3b;margin-top:18px;">
    Redeemable through <strong>${fmtDate(v.expires_at)}</strong> · Non-transferable
  </p>
  <p style="font-size:13px;color:#6b5a3b;margin-top:8px;">
    Questions? Reply to this email or call us — we'd love to help you book.
  </p>
  <p style="font-family:cursive;font-size:30px;color:#a17e3a;margin-top:32px;">Happy Mother's Day</p>
  `;
  return shell(inner);
}

// ---------- Receipt email — for the buyer ----------
function buildBuyerHtml(v: any, opts: { isGift: boolean }) {
  const greeting = opts.isGift
    ? `Your gift is on its way to <strong>${v.recipient_name}</strong>.`
    : `Your Mother's Day voucher is ready.`;

  const cta = opts.isGift
    ? `<p style="font-size:13px;color:#6b5a3b;margin-top:8px;">We've also sent ${v.recipient_name} their own gift email at ${v.recipient_email}.</p>`
    : `<a href="${SITE}/spa?category=Massage"
         style="display:inline-block;background:#a17e3a;color:#fff;padding:14px 32px;border-radius:4px;text-decoration:none;font-weight:600;letter-spacing:2px;font-size:14px;margin:16px 0 8px;">
         BOOK YOUR MASSAGE
       </a>`;

  const inner = `
  <h1 style="font-size:34px;color:#a17e3a;margin:8px 0 4px;font-weight:500;">Thank You${v.buyer_first_name ? `, ${v.buyer_first_name}` : ""}</h1>
  <p style="font-size:16px;color:#6b5a3b;margin:0 0 24px;">${greeting}</p>

  <div style="margin:8px 0 24px;padding:24px 20px;background:#fff;border:2px dashed #c9a86a;border-radius:8px;">
    <p style="font-size:13px;letter-spacing:3px;color:#a17e3a;margin:0 0 6px;">MOTHER'S DAY SPECIAL</p>
    <p style="font-size:22px;color:#1c170f;margin:6px 0 4px;font-weight:600;">${v.massage_choice}</p>
    <p style="font-size:14px;color:#6b5a3b;margin:0 0 12px;">${v.massage_duration} min · + Wet Spa Access</p>
    <div style="font-size:11px;letter-spacing:3px;color:#a17e3a;margin-top:14px;">VOUCHER CODE</div>
    <div style="font-family:monospace;font-size:26px;letter-spacing:4px;color:#1c170f;margin-top:4px;">${v.code}</div>
  </div>

  ${cta}

  <p style="font-size:13px;color:#6b5a3b;margin-top:20px;">
    Redeemable through <strong>${fmtDate(v.expires_at)}</strong>
  </p>
  <p style="font-size:12px;color:#8a6d3b;margin-top:18px;">
    Total paid: $${((v.amount_paid_cents || 0) / 100).toFixed(2)}
  </p>
  `;
  return shell(inner);
}

interface SendResult {
  kind: "recipient" | "buyer" | "self";
  email: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  resend_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { voucher_id, only, triggered_by, preview, override_email } = await req.json();
    if (!voucher_id) throw new Error("voucher_id required");

    const { data: v, error: vErr } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("id", voucher_id)
      .single();
    if (vErr || !v) throw new Error(vErr?.message || "Voucher not found");

    const isGift = !!(v.recipient_email && v.recipient_email.trim());

    if (preview) {
      const recipient_subject = isGift ? `${v.buyer_name} sent you a Mother's Day gift 💛` : null;
      const recipient_html = isGift ? buildGiftHtml(v) : null;
      const buyer_subject = isGift
        ? `Your Mother's Day gift to ${v.recipient_name} is on its way`
        : "Your Mother's Day Special voucher";
      const buyer_html = buildBuyerHtml(v, { isGift });
      return new Response(
        JSON.stringify({
          success: true, preview: true,
          recipient_subject, recipient_html, recipient_to: v.recipient_email || null,
          buyer_subject, buyer_html, buyer_to: v.buyer_email || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (override_email && !only) {
      throw new Error("override_email requires 'only' to be set");
    }
    const overrideTo = override_email?.trim().toLowerCase() || null;

    const sends: Array<{
      kind: "recipient" | "buyer" | "self";
      to: string;
      subject: string;
      html: string;
    }> = [];

    if (isGift) {
      if (!only || only === "recipient") {
        sends.push({
          kind: "recipient",
          to: overrideTo || v.recipient_email,
          subject: `${v.buyer_name} sent you a Mother's Day gift 💛`,
          html: buildGiftHtml(v),
        });
      }
      if (!only || only === "buyer") {
        sends.push({
          kind: "buyer",
          to: overrideTo || v.buyer_email,
          subject: `Your Mother's Day gift to ${v.recipient_name} is on its way`,
          html: buildBuyerHtml(v, { isGift: true }),
        });
      }
    } else {
      if (!only || only === "self" || only === "buyer") {
        sends.push({
          kind: "self",
          to: overrideTo || v.buyer_email,
          subject: "Your Mother's Day Special voucher",
          html: buildBuyerHtml(v, { isGift: false }),
        });
      }
    }

    const effectiveTrigger = overrideTo
      ? `manual_override${triggered_by ? `:${triggered_by}` : ""}`
      : (triggered_by || "system");

    const results: SendResult[] = [];
    for (const s of sends) {
      try {
        const r = await resend.emails.send({
          from: FROM,
          to: [s.to],
          subject: s.subject,
          html: s.html,
        });
        const resendId = (r as any)?.data?.id || (r as any)?.id || null;
        const errMsg = (r as any)?.error?.message || null;
        if (errMsg) throw new Error(errMsg);

        results.push({ kind: s.kind, email: s.to, status: "sent", resend_id: resendId });
        await supabase.from("mothers_day_voucher_emails").insert({
          voucher_id: v.id,
          kind: s.kind,
          recipient_email: s.to,
          status: "sent",
          resend_id: resendId,
          triggered_by: effectiveTrigger,
        });
      } catch (e: any) {
        const msg = e?.message || String(e);
        results.push({ kind: s.kind, email: s.to, status: "failed", error: msg });
        await supabase.from("mothers_day_voucher_emails").insert({
          voucher_id: v.id,
          kind: s.kind,
          recipient_email: s.to,
          status: "failed",
          error_message: msg,
          triggered_by: effectiveTrigger,
        });
      }
    }

    const ok = results.every((r) => r.status === "sent");
    return new Response(JSON.stringify({ success: ok, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
