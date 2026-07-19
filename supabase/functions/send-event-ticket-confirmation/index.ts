// Sends an event ticket purchase confirmation email. Idempotent per
// Stripe checkout session via event_tickets.confirmation_email_sent_at.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Storm Wellness Club <hello@notify.stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";
const TZ = "America/Detroit";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });

function tierLabel(t: string) {
  if (t === "member") return "Member";
  if (t === "non_member" || t === "nonmember") return "Non-Member";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildHtml(opts: {
  firstName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  quantity: number;
  tierLabel: string;
  total: string;
  orderId: string;
  whatToBring?: string | null;
  details?: string | null;
  portalTicketsUrl: string;
}) {
  const extras = (s?: string | null) =>
    s && s.trim() ? `<p style="margin:0 0 16px;white-space:pre-line;">${s}</p>` : "";
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:26px;margin:0 0 18px;">You're in — ${opts.eventName} ✨</h1>
      <p style="margin:0 0 14px;">Hi ${opts.firstName || "there"},</p>
      <p style="margin:0 0 18px;">Thank you for reserving your spot at our <strong>${opts.eventName}</strong>. Your ticket is confirmed and we can't wait to host you.</p>

      <h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:22px 0 8px;">Your reservation</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 22px;">
        <tr><td style="padding:6px 0;color:#6b5a3b;">Event</td><td style="padding:6px 0;text-align:right;">${opts.eventName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Date</td><td style="padding:6px 0;text-align:right;">${opts.eventDate}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Time</td><td style="padding:6px 0;text-align:right;">${opts.eventTime}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Venue</td><td style="padding:6px 0;text-align:right;">${opts.venue}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Tickets</td><td style="padding:6px 0;text-align:right;">${opts.quantity} × ${opts.tierLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Total paid</td><td style="padding:6px 0;text-align:right;">$${opts.total}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Confirmation #</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px;">${opts.orderId}</td></tr>
      </table>

      ${opts.details ? `<h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:22px 0 8px;">What to expect</h3>${extras(opts.details)}` : ""}
      ${opts.whatToBring ? `<h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:22px 0 8px;">What to bring</h3>${extras(opts.whatToBring)}` : ""}

      <p style="margin:24px 0 8px;">Show this email or your QR code at check-in. Members can view tickets anytime in the portal:</p>
      <p style="text-align:center;margin:16px 0 24px;">
        <a href="${opts.portalTicketsUrl}" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">View my tickets</a>
      </p>

      <p style="font-size:13px;color:#6b5a3b;margin:24px 0 0;">Need to make a change? Reply to this email or reach us at support@stormwellnessclub.com — tickets are non-refundable but transferable up to 24 hours before the event.</p>
      <p style="font-size:12px;color:#8a7a5a;margin:22px 0 0;">With gratitude,<br/>The Storm Wellness Club Team</p>
    </div>
  </div>`;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, payment_intent_id } = await req.json();
    if (!session_id && !payment_intent_id) throw new Error("session_id or payment_intent_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let query = supabase
      .from("event_tickets")
      .select(
        "id, user_id, buyer_email, buyer_first_name, ticket_type, amount_cents, status, confirmation_email_sent_at, event_id, events(title, starts_at, venue, details, what_to_bring)"
      );
    query = payment_intent_id
      ? query.eq("stripe_payment_intent_id", payment_intent_id)
      : query.eq("stripe_session_id", session_id);

    const { data: tickets, error } = await query;

    if (error) throw error;
    if (!tickets || tickets.length === 0) throw new Error("no tickets for session");

    const first = tickets[0] as any;
    if (first.status !== "paid") {
      return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    if (tickets.every((t: any) => t.confirmation_email_sent_at)) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const to = first.buyer_email;
    if (!to) throw new Error("no buyer_email");

    const evt = first.events;
    const totalCents = tickets.reduce((s: number, t: any) => s + (t.amount_cents || 0), 0);
    const portalUrl = first.user_id ? `${SITE}/portal/my-tickets` : `${SITE}/events`;

    const html = buildHtml({
      firstName: first.buyer_first_name || "",
      eventName: evt?.title || "Storm Event",
      eventDate: evt?.starts_at ? fmtDate(evt.starts_at) : "",
      eventTime: evt?.starts_at ? fmtTime(evt.starts_at) : "",
      venue: evt?.venue || "Storm Wellness Club",
      quantity: tickets.length,
      tierLabel: tierLabel(first.ticket_type || ""),
      total: (totalCents / 100).toFixed(2),
      orderId: (payment_intent_id || session_id).slice(-10).toUpperCase(),
      whatToBring: evt?.what_to_bring ?? null,
      details: evt?.details ?? null,
      portalTicketsUrl: portalUrl,
    });

    const sendRes = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `You're in — ${evt?.title || "Storm Event"} ✨`,
      html,
    });

    if ((sendRes as any).error) throw new Error((sendRes as any).error.message || "resend failed");

    await supabase
      .from("event_tickets")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .in("id", tickets.map((t: any) => t.id));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("send-event-ticket-confirmation error:", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
