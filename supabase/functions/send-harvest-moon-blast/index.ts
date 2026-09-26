// Under the Harvest Moon — members-only invitation email.
// Admin-only. Modes: preview (return HTML), testEmail (single send), else blast to members.
// Idempotent on email_type='harvest_moon_sep_27_2026'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { escapeHtml, isAllowedTestRecipient } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_KEY = "harvest_moon_sep_27_2026";
const TEST_TEMPLATE_KEY = "harvest_moon_sep_27_2026_test";
const BASE_URL = "https://stormwellnessclub.com";
const EVENT_URL = `${BASE_URL}/events/under-the-harvest-moon`;
const SUBJECT = "An Invitation: Under the Harvest Moon — Sunday, September 27";
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";

function buildHtml(firstName: string | null): string {
  const greeting = firstName ? `Dear ${escapeHtml(firstName)},` : "Dear Member,";
  return `
    <div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
      <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
        <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display:block;margin:0 auto;" />
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
      <div style="background:#ffffff;padding:34px 30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;color:#1C170F;line-height:1.75;">
        <p style="color:#a17e3a;font-family:Arial,sans-serif;letter-spacing:2.5px;font-size:11px;margin:0 0 10px;">AN INVITATION</p>
        <h1 style="font-family:Georgia,serif;font-weight:500;margin:0 0 6px;font-size:28px;line-height:1.25;">Under the Harvest Moon</h1>
        <p style="color:#88766B;margin:0 0 20px;font-style:italic;font-size:16px;">A Women's Release &amp; Renewal Circle</p>

        <div style="background:#F7F4EC;border:1px solid #E7DFCF;padding:18px 20px;border-radius:6px;margin:0 0 24px;">
          <p style="margin:0 0 4px;font-size:15px;"><strong>Sunday, September 27 &middot; 6:00 PM</strong></p>
          <p style="margin:0 0 4px;font-size:15px;">Storm Wellness Club</p>
          <p style="margin:8px 0 0;font-size:14px;color:#88766B;">An exclusive members-only evening, included with your membership</p>
        </div>

        <p style="margin:0 0 16px;">${greeting}</p>

        <p style="margin:0 0 16px;">Step into an intimate, restorative space designed to help you slow down, turn inward, and reconnect with yourself.</p>

        <p style="margin:0 0 16px;">Facilitated by Savannah Rae Alawieh, Shaman, Reiki Master, Astrologer, and Psychic Medium. This guided experience will introduce guests to energy healing: a gentle practice centered on restoring balance, releasing emotional heaviness, and bringing awareness to where stress or stagnant energy may be held within the body.</p>

        <p style="margin:0 0 16px;">Envision a softly lit circle, grounding guidance, intentional stillness, and the shared energy of women gathering in a safe, supportive space. The evening will culminate in a symbolic fire-cleansing ritual, inviting each guest to identify what she is ready to release and offer it to the fire creating space for renewed clarity, intention, and personal transformation.</p>

        <p style="margin:0 0 24px;">This is an invitation to pause, soften, and leave feeling lighter, more grounded, and deeply connected to yourself.</p>

        <div style="text-align:center;margin:30px 0;">
          <a href="${EVENT_URL}" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:15px 34px;text-decoration:none;border-radius:4px;font-weight:600;font-family:Georgia,serif;letter-spacing:0.5px;min-width:240px;">Reserve my place</a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0;" />

        <h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 8px;">What to bring</h2>
        <p style="margin:0 0 20px;">Comfortable clothing you can sit and move in, a water bottle, and an open mind. Everything else is provided.</p>

        <p style="margin:0;font-size:14px;color:#88766B;font-style:italic;">By reservation &middot; Seating intentionally limited</p>

        <p style="margin:26px 0 0;">With warmth,<br/>The Storm Wellness Club Team</p>

        <p style="margin:22px 0 0;font-size:13px;color:#88766B;text-align:center;">
          <a href="${EVENT_URL}" style="color:#a17e3a;">View the invitation &rarr;</a>
        </p>
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
    if (!(await isAllowedTestRecipient(req, email))) {
      return new Response(JSON.stringify({ error: "Test emails can only go to club addresses or your own email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const resp = await resend.emails.send({
        from: FROM,
        to: [email],
        subject: `[TEST] ${SUBJECT}`,
        html: buildHtml(typeof body.firstName === "string" ? body.firstName.slice(0, 60) : "Team"),
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
        return new Response(
          JSON.stringify({ ok: false, error: (resp as any)?.error?.message ?? "unknown" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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

  // Blast: members who can actually attend — active and frozen, never cancelled.
  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status")
    .in("status", ["active", "frozen"]);

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
        from: FROM,
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
      total_members: members?.length ?? 0,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
