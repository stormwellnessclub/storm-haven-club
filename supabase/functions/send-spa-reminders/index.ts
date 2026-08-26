// Spa appointment reminders — sends 24-hour and 2-hour reminders (email + SMS).
// Idempotent via reminder_24h_sent_at / reminder_2h_sent_at columns.
//
// Triggered by pg_cron (every 5–15 min). Operates in America/Detroit timezone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Window = "24h" | "2h";

function chicagoNow(): Date {
  // Get current time as if it were Chicago local. We compute by formatting and reparsing.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}`,
  );
}

function formatChicago(d: Date) {
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Detroit",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Detroit",
    }),
  };
}

async function processWindow(admin: any, window: Window) {
  // Compute the appointment_date / appointment_time slots that fall into the window.
  // We use a generous +/- buffer so we catch them even with cron jitter.
  const now = chicagoNow();
  const targetMs =
    now.getTime() + (window === "24h" ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000);
  const target = new Date(targetMs);

  // Window: target ± 15 minutes for 24h, ± 5 minutes for 2h (cron runs every 15/5 min).
  const bufferMin = window === "24h" ? 15 : 5;
  const lo = new Date(target.getTime() - bufferMin * 60 * 1000);
  const hi = new Date(target.getTime() + bufferMin * 60 * 1000);

  // Format date in Chicago for the SQL filter (appointment_date is a date column).
  const loDate = lo.toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
  const hiDate = hi.toLocaleDateString("en-CA", { timeZone: "America/Detroit" });

  const sentCol = window === "24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";

  // Pull candidate appointments (broader date range; we filter exact time in code).
  const { data: appts, error } = await admin
    .from("spa_appointments")
    .select(
      "id, user_id, service_name, service_category, appointment_date, appointment_time, duration_minutes, staff_id, status, " +
        sentCol,
    )

    .in("appointment_date", Array.from(new Set([loDate, hiDate])))
    .eq("status", "confirmed")
    .is(sentCol, null)
    .limit(500);

  if (error) {
    console.error("spa-reminders fetch error:", error);
    return { window, attempted: 0, sent: 0 };
  }

  let sent = 0;

  for (const a of appts ?? []) {
    try {
      // Build the appointment local datetime in Chicago.
      const apptLocal = new Date(`${a.appointment_date}T${a.appointment_time}`);
      // apptLocal is interpreted as UTC by JS; we instead derive the offset by re-rendering both
      // and comparing. Simpler: rely on the local-string interpretation matching server tz.
      // We approximate by computing the minute-diff between target (Chicago wall clock now+offset)
      // and apptLocal using string comparisons.
      const apptKey = `${a.appointment_date} ${a.appointment_time.slice(0, 5)}`;
      const targetKey = `${target.toLocaleDateString("en-CA", { timeZone: "America/Detroit" })} ${target.toLocaleTimeString("en-GB", { timeZone: "America/Detroit", hour: "2-digit", minute: "2-digit" })}`;
      const apptMin =
        new Date(`2000-01-01T${a.appointment_time}`).getHours() * 60 +
        new Date(`2000-01-01T${a.appointment_time}`).getMinutes();
      const tMin =
        Number(targetKey.slice(11, 13)) * 60 + Number(targetKey.slice(14, 16));
      const sameDay = apptKey.slice(0, 10) === targetKey.slice(0, 10);
      if (!sameDay) continue;
      if (Math.abs(apptMin - tMin) > bufferMin) continue;

      // Look up contact (members → profiles, fall back to non_member_profiles).
      let email: string | null = null;
      let phone: string | null = null;
      let smsOptIn = false;
      const { data: p } = await admin
        .from("profiles")
        .select("email, phone, sms_opt_in")
        .eq("user_id", a.user_id)
        .maybeSingle();
      if (p) {
        email = p.email ?? null;
        phone = p.phone ?? null;
        smsOptIn = p.sms_opt_in === true;
      }
      if (!email || !phone) {
        const { data: nm } = await admin
          .from("non_member_profiles")
          .select("email, phone, sms_opt_in")
          .eq("user_id", a.user_id)
          .maybeSingle();
        if (nm) {
          email = email ?? nm.email ?? null;
          phone = phone ?? nm.phone ?? null;
          smsOptIn = smsOptIn || nm.sms_opt_in === true;
        }
      }

      let provider = "Storm Wellness";
      if (a.staff_id) {
        const { data: staff } = await admin
          .from("spa_therapists")
          .select("full_name")
          .eq("id", a.staff_id)
          .maybeSingle();
        if (staff?.full_name) provider = staff.full_name;
      }

      const dateLabel = new Date(`${a.appointment_date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Detroit",
      });
      const timeLabel = new Date(`2000-01-01T${a.appointment_time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      // Audience-aware links + intake reminder (massage/body services only).
      const { data: memberRow } = await admin
        .from("members")
        .select("id")
        .eq("user_id", a.user_id)
        .maybeSingle();
      const bookingsPath = memberRow ? "/member/bookings" : "/portal/bookings";

      const cat = (a.service_category || "").toLowerCase();
      const svcName = (a.service_name || "").toLowerCase();
      const intakeService =
        cat.includes("massage") || cat.includes("body") || svcName.includes("massage");
      let needsIntake = false;
      if (intakeService) {
        const { data: intake } = await admin
          .from("spa_intake_forms")
          .select("id")
          .eq("appointment_id", a.id)
          .maybeSingle();
        needsIntake = !intake;
      }

      const smsKey = window === "24h" ? "appointment-reminder-24h" : "appointment-reminder-2h";
      const smsVars =
        window === "24h"
          ? { service: a.service_name, time: timeLabel, provider }
          : { service: a.service_name, time: timeLabel };

      await Promise.allSettled([
        email
          ? fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({
                type: "spa_appointment_reminder",
                to: email,
                data: {
                  service: a.service_name,
                  date: dateLabel,
                  time: timeLabel,
                  provider,
                  window,
                  bookingsPath,
                  needsIntake,
                  intakeUrlPath: `${bookingsPath}?intake=${a.id}`,
                },
              }),
            })

          : Promise.resolve(),
        phone && smsOptIn
          ? fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({
                to: { phone, userId: a.user_id },
                templateKey: smsKey,
                variables: smsVars,
                idempotencyKey: `spa-rem-${window}-${a.id}`,
                metadata: { source: "spa_reminder", window, appointmentId: a.id },
              }),
            })
          : Promise.resolve(),
      ]);

      // Mark as sent (idempotency).
      await admin
        .from("spa_appointments")
        .update({ [sentCol]: new Date().toISOString() })
        .eq("id", a.id);

      sent++;
    } catch (err) {
      console.error(`spa-reminders ${window} appt ${a.id} error:`, err);
    }
  }

  return { window, attempted: (appts ?? []).length, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const url = new URL(req.url);
    const onlyWindow = url.searchParams.get("window") as Window | null;
    const windows: Window[] = onlyWindow ? [onlyWindow] : ["24h", "2h"];

    const results = [];
    for (const w of windows) {
      results.push(await processWindow(admin, w));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("spa-reminders fatal:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message ?? String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
