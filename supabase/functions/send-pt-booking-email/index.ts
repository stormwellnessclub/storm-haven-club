// Sends PT appointment confirmation or cancellation emails.
// Idempotent for confirmations via pt_appointments.confirmation_email_sent_at.
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

const FORMAT_LABEL: Record<string, string> = {
  one_on_one: "1:1 Personal Training",
  reformer_one_on_one: "Reformer Pilates 1:1",
  semi_private: "Semi-Private (max 4)",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short",
  });

function buildConfirmation(opts: {
  name: string; formatLabel: string; trainerName: string;
  startsAt: string; durationMinutes: number; sessionsRemaining: number;
}) {
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:26px;margin:0 0 16px;">You're booked, ${opts.name}!</h1>
      <p style="margin:0 0 16px;">Your Personal Training session is confirmed. We can't wait to see you.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0 22px;">
        <tr><td style="padding:6px 0;color:#6b5a3b;">Session</td><td style="padding:6px 0;text-align:right;">${opts.formatLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Trainer</td><td style="padding:6px 0;text-align:right;">${opts.trainerName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">When</td><td style="padding:6px 0;text-align:right;">${fmtDateTime(opts.startsAt)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Duration</td><td style="padding:6px 0;text-align:right;">${opts.durationMinutes} min</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Sessions left</td><td style="padding:6px 0;text-align:right;">${opts.sessionsRemaining}</td></tr>
      </table>
      <div style="background:#fef6e6;border-left:3px solid #c9a86a;padding:14px 16px;margin:18px 0;font-size:13px;color:#5b4a2c;">
        <strong>Cancellation policy:</strong> Free cancellation up to <strong>24 hours</strong> before your session.
        Late cancellations and no-shows forfeit the session from your pack.
      </div>
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${SITE}/portal/passes" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">View My Sessions</a>
      </p>
      <p style="font-size:12px;color:#8a7a5a;margin:28px 0 0;text-align:center;">Storm Wellness Club, Livonia, MI.</p>
    </div>
  </div>`;
}

function buildCancellation(opts: {
  name: string; formatLabel: string; trainerName: string;
  startsAt: string; sessionRefunded: boolean;
}) {
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:24px;margin:0 0 14px;">Session cancelled</h1>
      <p style="margin:0 0 14px;">Hi ${opts.name}, your Personal Training session has been cancelled.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0 22px;">
        <tr><td style="padding:6px 0;color:#6b5a3b;">Session</td><td style="padding:6px 0;text-align:right;">${opts.formatLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Trainer</td><td style="padding:6px 0;text-align:right;">${opts.trainerName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">When</td><td style="padding:6px 0;text-align:right;">${fmtDateTime(opts.startsAt)}</td></tr>
      </table>
      <p style="margin:0 0 14px;">${opts.sessionRefunded
        ? "The session has been returned to your pack."
        : "Because this was a late cancellation, the session was forfeited from your pack."}</p>
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${SITE}/portal/passes" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">Book Another Session</a>
      </p>
    </div>
  </div>`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

function buildRecap(opts: {
  name: string; formatLabel: string; trainerName: string;
  startsAt: string; recap: string; homework: string;
}) {
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:24px;margin:0 0 14px;">Your session recap</h1>
      <p style="margin:0 0 14px;">Hi ${opts.name}, here's a recap of your ${opts.formatLabel} session with ${opts.trainerName} on ${fmtDateTime(opts.startsAt)}.</p>
      <div style="background:#fef6e6;border-left:3px solid #c9a86a;padding:14px 16px;margin:18px 0;font-size:14px;color:#5b4a2c;">${esc(opts.recap)}</div>
      ${opts.homework ? `<h2 style="font-size:16px;color:#a17e3a;margin:22px 0 8px;">Homework</h2><p style="margin:0 0 14px;font-size:14px;">${esc(opts.homework)}</p>` : ""}
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${SITE}/portal/passes" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">Book Your Next Session</a>
      </p>
      <p style="font-size:12px;color:#8a7a5a;margin:28px 0 0;text-align:center;">Storm Wellness Club, Livonia, MI.</p>
    </div>
  </div>`;
}


const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { appointment_id, type, recap, homework } = await req.json();
    if (!appointment_id) throw new Error("appointment_id required");
    const kind: "confirmation" | "cancellation" | "session_recap" =
      type === "cancellation" ? "cancellation" : type === "session_recap" ? "session_recap" : "confirmation";
    if (kind === "session_recap" && !String(recap ?? "").trim()) throw new Error("recap text required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: appt, error } = await supabase
      .from("pt_appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (error || !appt) throw new Error(error?.message || "appointment not found");

    if (kind === "confirmation" && appt.confirmation_email_sent_at) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Recipient
    let email: string | null = null;
    let name = "there";
    const { data: authUser } = await supabase.auth.admin.getUserById(appt.user_id);
    email = authUser?.user?.email || null;
    const meta = authUser?.user?.user_metadata || {};
    if (meta.first_name) name = meta.first_name;
    else if (meta.full_name) name = String(meta.full_name).split(" ")[0];
    if (!email || name === "there") {
      const { data: m } = await supabase.from("members")
        .select("email,first_name").eq("user_id", appt.user_id).maybeSingle();
      if (m) { email = email || m.email; if (m.first_name) name = m.first_name; }
    }
    if (!email) throw new Error("recipient email not found");

    // Trainer
    let trainerName = "Your trainer";
    if (appt.instructor_id) {
      const { data: ins } = await supabase.from("instructors")
        .select("first_name,last_name").eq("id", appt.instructor_id).maybeSingle();
      if (ins) trainerName = `${ins.first_name ?? ""} ${ins.last_name ?? ""}`.trim() || trainerName;
    }

    // Pass for remaining
    let sessionsRemaining = 0;
    if (appt.pass_id) {
      const { data: pass } = await supabase.from("pt_passes")
        .select("sessions_remaining").eq("id", appt.pass_id).maybeSingle();
      sessionsRemaining = pass?.sessions_remaining ?? 0;
    }

    const formatLabel = FORMAT_LABEL[appt.format] ?? appt.format;

    const subject = kind === "confirmation"
      ? "Your Personal Training session is booked"
      : kind === "session_recap"
        ? "Your Personal Training session recap"
        : "Your Personal Training session was cancelled";

    const html = kind === "confirmation"
      ? buildConfirmation({ name, formatLabel, trainerName, startsAt: appt.starts_at, durationMinutes: appt.duration_minutes, sessionsRemaining })
      : kind === "session_recap"
        ? buildRecap({ name, formatLabel, trainerName, startsAt: appt.starts_at, recap: String(recap ?? ""), homework: String(homework ?? "") })
        : buildCancellation({ name, formatLabel, trainerName, startsAt: appt.starts_at, sessionRefunded: appt.status === "cancelled" });

    const { error: sendErr } = await resend.emails.send({
      from: FROM, to: [email], subject, html,
    });
    if (sendErr) throw new Error(sendErr.message);

    if (kind === "confirmation") {
      await supabase.from("pt_appointments")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", appointment_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});
