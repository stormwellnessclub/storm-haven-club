// July 23 2026 maintenance announcement email blast.
// Admin-only. Modes: preview (return HTML), testEmail (single send), else blast all active members.
// Idempotent on email_type='maintenance_jul_23_2026'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_KEY = "maintenance_jul_23_2026";
const TEST_TEMPLATE_KEY = "maintenance_jul_23_2026_test";
const BASE_URL = "https://stormwellnessclub.com";
const SUBJECT = "Heads up: Thursday 7/23 opening at 7:30 AM (brief maintenance)";

function buildHtml(firstName: string | null): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return `
    <div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
      <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#1C170F;">STORM WELLNESS CLUB</div>
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
      <div style="background:#ffffff;padding:32px 30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;color:#1C170F;">
        <p style="color:#a17e3a;font-family:Arial,sans-serif;letter-spacing:2px;font-size:11px;margin:0 0 8px;">A QUICK HEADS UP</p>
        <h1 style="font-family:Georgia,serif;font-weight:500;margin:0 0 6px;font-size:26px;line-height:1.25;">Scheduled Maintenance &mdash; Thursday, July 23</h1>
        <p style="color:#88766B;margin:0 0 22px;font-style:italic;">Late open at 7:30 AM &middot; brief afternoon window 2&ndash;4 PM</p>

        <p>${greeting}</p>
        <p>A quick note about <strong>Thursday, July 23</strong>:</p>

        <div style="background:#F7F4EC;border:1px solid #E7DFCF;padding:18px 20px;border-radius:6px;margin:14px 0 22px;">
          <p style="margin:0 0 10px;font-size:15px;">
            <strong>We'll open at 7:30 AM</strong> instead of our usual time so our team can complete required interior maintenance before members arrive.
          </p>
          <p style="margin:0;font-size:15px;">
            <strong>Between 2:00 PM and 4:00 PM</strong>, we'll need approximately <strong>one hour of limited access to one of the locker rooms</strong> to finish a second maintenance task. The rest of the facility and all amenities will remain fully available during that window.
          </p>
        </div>

        <p>Everything else runs on the normal schedule &mdash; classes, recovery, spa, cafe, and the studios are all open as usual once we unlock the doors at 7:30 AM.</p>

        <p>Thank you for your patience as we keep the club in top shape for you.</p>

        <p style="margin:28px 0 0;">Warmly,<br/><strong>The Storm Wellness Club Team</strong></p>
      </div>
      <div style="background:#1C170F;padding:25px;text-align:center;color:#DEDACE;font-family:Georgia,serif;font-size:13px;">
        <p style="margin:0 0 6px 0;">Storm Wellness Club</p>
        <p style="margin:0;">Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:#DEDACE;">admin@stormwellnessclub.com</a></p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = await requireStaff(req, ["admin", "super_admin"]);
  if (!gate.ok) return gate.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }

  if (body?.preview) {
    return new Response(buildHtml("Jane"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const resend = new Resend(resendKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  if (body?.testEmail) {
    const email = String(body.testEmail).trim().toLowerCase();
    try {
      const resp = await resend.emails.send({
        from: "Storm Wellness Club <admin@stormwellnessclub.com>",
        to: [email],
        subject: `[TEST] ${SUBJECT}`,
        html: buildHtml(body.firstName ?? "Team"),
        reply_to: "admin@stormwellnessclub.com",
      });
      const status = (resp as any)?.error ? "failed" : "sent";
      await supabase.from("email_audit_log").insert({
        recipient_email: email,
        recipient_name: null,
        email_type: TEST_TEMPLATE_KEY,
        trigger_source: "admin_test",
        triggered_by: gate.userId === "service_role" ? null : gate.userId,
        subject: `[TEST] ${SUBJECT}`,
        status,
        error_message: (resp as any)?.error?.message ?? null,
      });
      if (status === "failed") {
        return new Response(JSON.stringify({ ok: false, error: (resp as any)?.error?.message ?? "unknown" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, sentTo: email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status")
    .eq("status", "active");

  if (memErr) {
    return new Response(JSON.stringify({ error: memErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: sentRows } = await supabase
    .from("email_audit_log")
    .select("recipient_email")
    .eq("email_type", TEMPLATE_KEY);
  const alreadySent = new Set(
    (sentRows ?? []).map((r: any) => String(r.recipient_email || "").toLowerCase()),
  );

  let queued = 0;
  let skipped = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const m of members ?? []) {
    const email = String(m.email || "").trim().toLowerCase();
    if (!email || alreadySent.has(email)) {
      skipped++;
      continue;
    }
    try {
      const resp = await resend.emails.send({
        from: "Storm Wellness Club <admin@stormwellnessclub.com>",
        to: [email],
        subject: SUBJECT,
        html: buildHtml(m.first_name ?? null),
        reply_to: "admin@stormwellnessclub.com",
      });
      const status = (resp as any)?.error ? "failed" : "sent";
      await supabase.from("email_audit_log").insert({
        recipient_email: email,
        recipient_name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null,
        email_type: TEMPLATE_KEY,
        trigger_source: "admin_blast",
        triggered_by: gate.userId === "service_role" ? null : gate.userId,
        member_id: m.id,
        subject: SUBJECT,
        status,
        error_message: (resp as any)?.error?.message ?? null,
      });
      if (status === "sent") {
        queued++;
        alreadySent.add(email);
      } else {
        errors.push({ email, error: (resp as any)?.error?.message ?? "unknown" });
      }
    } catch (e: any) {
      errors.push({ email, error: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      queued,
      skipped,
      total_active: members?.length ?? 0,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
