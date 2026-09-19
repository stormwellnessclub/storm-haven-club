// Sends confirmation emails for complimentary (no-payment) event seats:
// member reservations, approved guest seats, and released waitlist seats.
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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
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

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildHtml(o: {
  greetingName: string;
  lead: string;
  eventName: string;
  subtitle?: string | null;
  dateLine: string;
  venue: string;
  whatToBring?: string | null;
  closing: string;
  ctaUrl: string;
  ctaLabel: string;
}) {
  const bring = o.whatToBring?.trim()
    ? `<p style="margin:0 0 18px;color:#3a2e1a;font-family:Georgia,serif;font-size:15px;white-space:pre-line;"><strong>What to bring:</strong> ${esc(o.whatToBring)}</p>`
    : "";
  const sub = o.subtitle?.trim()
    ? `<p style="margin:0 0 6px;color:#6b5a3b;font-family:Georgia,serif;font-style:italic;font-size:15px;">${esc(o.subtitle)}</p>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.eventName)}</title></head>
<body style="margin:0;padding:0;background:#ece2d2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece2d2;padding:24px 0;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #c9a86a;border-radius:6px;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 18px;color:#3a2e1a;font-family:Georgia,serif;font-size:16px;">${esc(o.greetingName ? `Dear ${o.greetingName},` : "Hello,")}</p>
          <p style="margin:0 0 22px;color:#3a2e1a;font-family:Georgia,serif;font-size:16px;line-height:1.6;">${esc(o.lead)}</p>
          <div style="border:1px solid #e3d6bd;border-radius:6px;padding:18px 20px;margin:0 0 22px;background:#faf6ee;">
            <h2 style="margin:0 0 4px;color:#3a2e1a;font-family:Georgia,serif;font-size:22px;">${esc(o.eventName)}</h2>
            ${sub}
            <p style="margin:8px 0 0;color:#6b5a3b;font-family:Georgia,serif;font-size:15px;">${esc(o.dateLine)}</p>
            <p style="margin:4px 0 0;color:#6b5a3b;font-family:Georgia,serif;font-size:15px;">${esc(o.venue)}</p>
          </div>
          ${bring}
          <p style="margin:0 0 24px;color:#3a2e1a;font-family:Georgia,serif;font-size:15px;line-height:1.6;">${esc(o.closing)}</p>
          <p style="margin:0 0 28px;">
            <a href="${o.ctaUrl}" style="display:inline-block;background:#3a2e1a;color:#f7f1e4;text-decoration:none;font-family:Georgia,serif;font-size:15px;padding:12px 22px;border-radius:4px;">${esc(o.ctaLabel)}</a>
          </p>
          <p style="margin:0 0 32px;color:#6b5a3b;font-family:Georgia,serif;font-size:14px;">Warmly,<br/>The Storm Wellness Club Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const ticketId: string | undefined = body?.ticket_id;
    const kind: string = body?.kind ?? "reservation";
    if (!ticketId || typeof ticketId !== "string") throw new Error("ticket_id is required");
    if (!["reservation", "guest_approved", "waitlist_released"].includes(kind)) {
      throw new Error("invalid kind");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: authData } = await anon.auth.getUser(authHeader.slice(7));
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: ticket, error } = await supabase
      .from("event_tickets")
      .select(
        "id, user_id, buyer_email, buyer_first_name, attendee_email, attendee_first_name, status, confirmation_email_sent_at, events(slug, title, subtitle, starts_at, venue, what_to_bring)",
      )
      .eq("id", ticketId)
      .maybeSingle();
    if (error) throw error;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "paid") {
      return new Response(JSON.stringify({ success: false, reason: "not_confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ticket.confirmation_email_sent_at) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the seat holder or staff may trigger the email.
    const isOwner = ticket.user_id === authData.user.id;
    let allowed = isOwner;
    if (!allowed) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);
      allowed = (roles ?? []).some((r: { role: string }) =>
        ["super_admin", "admin", "manager", "front_desk"].includes(r.role)
      );
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evt = (ticket as unknown as { events: Record<string, string | null> }).events;
    const to = (kind === "guest_approved" ? ticket.attendee_email : null) || ticket.buyer_email;
    if (!to) throw new Error("No recipient email");

    const dateLine = evt?.starts_at
      ? `${fmtDate(evt.starts_at)} at ${fmtTime(evt.starts_at)} · doors at 5:45 PM`
      : "";

    const copy = {
      reservation: {
        subject: `Your seat is reserved — ${evt?.title ?? "Storm Wellness Club"}`,
        lead: "Your seat is reserved. We are so glad you will be joining us.",
        closing:
          "If your plans change, please let us know so your seat can be offered to another member waiting to attend.",
      },
      guest_approved: {
        subject: `Your guest seat is confirmed — ${evt?.title ?? "Storm Wellness Club"}`,
        lead: "A seat has been held for you at Storm Wellness Club. We look forward to welcoming you.",
        closing:
          "Please arrive a few minutes early so we can greet you and settle you into the circle.",
      },
      waitlist_released: {
        subject: `A seat has opened — ${evt?.title ?? "Storm Wellness Club"}`,
        lead: "A seat has opened and it is yours. Your place is now confirmed.",
        closing:
          "If you are no longer able to join us, please let us know so the seat can pass to the next member.",
      },
    }[kind as "reservation" | "guest_approved" | "waitlist_released"];

    const html = buildHtml({
      greetingName:
        (kind === "guest_approved" ? ticket.attendee_first_name : ticket.buyer_first_name) || "",
      lead: copy.lead,
      eventName: evt?.title ?? "Storm Wellness Club",
      subtitle: evt?.subtitle ?? null,
      dateLine,
      venue: evt?.venue || "Storm Wellness Club · Livonia, MI",
      whatToBring: evt?.what_to_bring ?? null,
      closing: copy.closing,
      ctaUrl: ticket.user_id ? `${SITE}/portal/my-tickets` : `${SITE}/events/${evt?.slug ?? ""}`,
      ctaLabel: ticket.user_id ? "View my reservation" : "View event details",
    });

    await resend.emails.send({ from: FROM, to: [to], subject: copy.subject, html });

    await supabase
      .from("event_tickets")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", ticket.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-event-reservation-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
