// Spa appointment reminders — sends 24-hour and 2-hour reminders (email + SMS).
// Idempotent via reminder_24h_sent_at / reminder_2h_sent_at columns.
//
// Triggered by pg_cron (every 5–15 min). Operates in America/Detroit timezone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import { appointmentLabels, isReminderDue, reminderBounds, type ReminderWindow } from "./timing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type Window = ReminderWindow;

async function processWindow(admin: any, window: Window) {
  const bounds = reminderBounds(new Date(), window);

  const sentCol = window === "24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";

  // Pull candidate appointments (broader date range; we filter exact time in code).
  const { data: appts, error } = await admin
    .from("spa_appointments")
    .select(
      "id, user_id, service_name, service_category, appointment_date, appointment_time, duration_minutes, staff_id, status, " +
        sentCol,
    )

    .in("appointment_date", bounds.dates)
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
      if (!isReminderDue(a.appointment_date, a.appointment_time, bounds)) continue;

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

      const { date: dateLabel, time: timeLabel } = appointmentLabels(a.appointment_date, a.appointment_time);

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
      const intakeKind = cat.includes("wrap") || svcName.includes("wrap") ? "body_wrap" : "massage";
      let needsIntake = false;
      if (intakeService) {
        const { data: intake } = await admin
          .from(intakeKind === "body_wrap" ? "spa_body_wrap_intakes" : "spa_intake_forms")
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
                  intakeKind,
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
