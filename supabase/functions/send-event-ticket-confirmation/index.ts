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

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";
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
  giftFromName?: string | null;
  attendeeNames?: string[] | null;
  isAttendeeCopy?: boolean;
}) {
  const extras = (s?: string | null) =>
    s && s.trim() ? `<p style="margin:0 0 16px;white-space:pre-line;color:#3a2e1a;font-family:Georgia,serif;">${s}</p>` : "";
  const row = (label: string, value: string, mono = false) => `
    <tr>
      <td style="padding:6px 0;color:#6b5a3b;font-family:Georgia,serif;font-size:14px;">${label}</td>
      <td style="padding:6px 0;text-align:right;font-family:${mono ? "monospace" : "Georgia,serif"};font-size:${mono ? "12px" : "14px"};color:#3a2e1a;">${value}</td>
    </tr>`;

  const giftBanner = opts.giftFromName
    ? `<div style="margin:0 0 18px 0;padding:12px 14px;background:#faf3e4;border:1px solid #c9a86a;border-radius:4px;color:#6b5a3b;font-family:Georgia,serif;font-size:14px;">
         🎁 <strong>${opts.giftFromName}</strong> ${opts.isAttendeeCopy ? "gifted you this ticket." : "purchased this ticket for someone else."}
       </div>`
    : "";

  const attendeeLine = opts.attendeeNames && opts.attendeeNames.length && !opts.isAttendeeCopy
    ? `<p style="margin:0 0 14px 0;color:#3a2e1a;">Ticket${opts.attendeeNames.length > 1 ? "s" : ""} reserved for: <strong>${opts.attendeeNames.join(", ")}</strong>.</p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.eventName}</title></head>
<body style="margin:0;padding:0;background:#ece2d2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece2d2;padding:24px 0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #c9a86a;border-radius:6px;">
          <tr>
            <td align="center" style="padding:32px 28px 8px 28px;">
              <div style="letter-spacing:.4em;font-size:11px;color:#a17e3a;font-family:Helvetica,Arial,sans-serif;text-align:center;">STORM WELLNESS CLUB</div>
              <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:24px;line-height:1.3;margin:10px 0 0 0;text-align:center;font-weight:normal;">You're in — ${opts.eventName} ✨</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px 28px;font-family:Georgia,serif;color:#3a2e1a;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 14px 0;">Hi ${opts.firstName || "there"},</p>
              ${giftBanner}
              <p style="margin:0 0 18px 0;">Thank you for reserving your spot at our <strong>${opts.eventName}</strong>. Your ticket is confirmed and we can't wait to host you.</p>
              ${attendeeLine}
              <h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:20px 0 8px 0;font-weight:normal;">Your reservation</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                ${row("Event", opts.eventName)}
                ${row("Date", opts.eventDate)}
                ${row("Time", opts.eventTime)}
                ${row("Venue", opts.venue)}
                ${row("Tickets", `${opts.quantity} × ${opts.tierLabel}`)}
                ${row("Total paid", `$${opts.total}`)}
                ${row("Confirmation #", opts.orderId, true)}
              </table>
              ${opts.details ? `<h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:20px 0 8px 0;font-weight:normal;">What to expect</h3>${extras(opts.details)}` : ""}
              ${opts.whatToBring ? `<h3 style="font-family:Georgia,serif;color:#a17e3a;font-size:16px;margin:20px 0 8px 0;font-weight:normal;">What to bring</h3>${extras(opts.whatToBring)}` : ""}
              <p style="margin:24px 0 8px 0;">Show this email or your QR code at check-in. You can view your ticket anytime here:</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 24px 28px;">
              <a href="${opts.portalTicketsUrl}" style="background:#a17e3a;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;font-size:14px;">View my tickets</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:Georgia,serif;color:#6b5a3b;font-size:13px;line-height:1.5;">
              <p style="margin:0 0 12px 0;">Need to make a change? Reply to this email or reach us at support@stormwellnessclub.com — tickets are non-refundable but transferable up to 24 hours before the event.</p>
              <p style="font-size:12px;color:#8a7a5a;margin:16px 0 0 0;">With gratitude,<br/>The Storm Wellness Club Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
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
        "id, user_id, buyer_email, buyer_first_name, buyer_last_name, ticket_type, amount_cents, status, confirmation_email_sent_at, event_id, stripe_payment_intent_id, is_gift, attendee_first_name, attendee_last_name, attendee_email, events(slug, title, starts_at, venue, details, what_to_bring)"
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
    const pi = first.stripe_payment_intent_id || payment_intent_id;
    const portalUrl = first.user_id
      ? `${SITE}/portal/my-tickets`
      : (evt?.slug && pi
          ? `${SITE}/events/${evt.slug}/success?payment_intent_id=${pi}`
          : `${SITE}/events`);

    const buyerFullName = `${first.buyer_first_name || ""} ${first.buyer_last_name || ""}`.trim() || "A Storm Wellness Club member";
    const anyGift = tickets.some((t: any) => t.is_gift && (t.attendee_first_name || t.attendee_last_name));
    const attendeeNames: string[] = tickets
      .map((t: any) => `${t.attendee_first_name || ""} ${t.attendee_last_name || ""}`.trim())
      .filter((s: string) => s.length > 0);

    // Purchaser copy (always to buyer)
    const buyerHtml = buildHtml({
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
      giftFromName: anyGift ? buyerFullName : null,
      attendeeNames: anyGift ? attendeeNames : null,
      isAttendeeCopy: false,
    });

    const sendRes = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `You're in — ${evt?.title || "Storm Event"} ✨`,
      html: buyerHtml,
    });

    if ((sendRes as any).error) throw new Error((sendRes as any).error.message || "resend failed");

    // Per-attendee copies for gifts where an attendee email is present and differs from the buyer.
    const buyerLower = String(to).toLowerCase();
    const attendeeSent = new Set<string>();
    for (const t of tickets as any[]) {
      const ae = (t.attendee_email || "").trim().toLowerCase();
      if (!ae || ae === buyerLower || attendeeSent.has(ae)) continue;
      attendeeSent.add(ae);
      try {
        const html = buildHtml({
          firstName: t.attendee_first_name || "",
          eventName: evt?.title || "Storm Event",
          eventDate: evt?.starts_at ? fmtDate(evt.starts_at) : "",
          eventTime: evt?.starts_at ? fmtTime(evt.starts_at) : "",
          venue: evt?.venue || "Storm Wellness Club",
          quantity: 1,
          tierLabel: tierLabel(t.ticket_type || ""),
          total: ((t.amount_cents || 0) / 100).toFixed(2),
          orderId: (payment_intent_id || session_id).slice(-10).toUpperCase(),
          whatToBring: evt?.what_to_bring ?? null,
          details: evt?.details ?? null,
          portalTicketsUrl: `${SITE}/events`,
          giftFromName: buyerFullName,
          attendeeNames: null,
          isAttendeeCopy: true,
        });
        await resend.emails.send({
          from: FROM,
          to: [t.attendee_email],
          subject: `You've been gifted a ticket — ${evt?.title || "Storm Event"} ✨`,
          html,
        });
      } catch (e) {
        console.error("attendee copy failed:", e);
      }
    }

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
