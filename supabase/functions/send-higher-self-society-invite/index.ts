// Higher Self Society — founding circle invitation email.
// Admin-only. Modes: preview (HTML), list (recipient roster), testEmail (single send),
// send (to all eligible members minus excludeEmails). Idempotent on TEMPLATE_KEY unless resend=true.
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
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TEMPLATE_KEY = "higher_self_society_invite_2026";
const TEST_TEMPLATE_KEY = "higher_self_society_invite_2026_test";
const BASE_URL = "https://stormwellnessclub.com";
const PAGE_URL = `${BASE_URL}/rituals/higher-self-society`;
const HERO = `${BASE_URL}/__l5e/assets-v1/762dc417-e0d1-4d2a-ba3e-813f57319098/hss-shelf.jpg`;
const SUBJECT = "You're invited: Higher Self Society, our founding reading circle";
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";

function buildHtml(firstName: string | null): string {
  const greeting = firstName ? `Dear ${escapeHtml(firstName)},` : "Dear Member,";
  return `
  <div style="background:#ffffff;padding:0;">
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;background:#1E0A0F;">
      <img src="${HERO}" alt="Higher Self Society" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
      <div style="padding:36px 34px 10px;color:#FBF7F2;line-height:1.75;">
        <p style="color:#C5A880;font-family:Arial,sans-serif;letter-spacing:3px;font-size:11px;margin:0 0 10px;">A MEMBER RITUAL &middot; FOUNDING CIRCLE</p>
        <h1 style="font-weight:400;margin:0 0 6px;font-size:32px;line-height:1.2;color:#FBF7F2;">Higher Self Society</h1>
        <p style="color:#C5A880;margin:0 0 26px;font-style:italic;font-size:16px;">An intimate monthly reading circle for Storm members.</p>
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 16px;">We are gathering a small circle of members who love books that shift how we see ourselves and the world. Once a month, we will meet at the club for two unhurried hours of thoughtful conversation, warm tea and good company.</p>
        <p style="margin:0 0 16px;">Before our first gathering, we would love your voice in shaping it:</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#EDE3D4;">
          <li style="margin:0 0 6px;">Choose your evening: Thursday 7&ndash;9 PM or Sunday 5&ndash;7 PM</li>
          <li style="margin:0 0 6px;">Pick the themes you would love to read</li>
          <li style="margin:0 0 6px;">Share one book that changed how you see life</li>
        </ul>
        <div style="background:#291118;border:1px solid rgba(197,168,128,0.35);border-radius:6px;padding:16px 18px;margin:0 0 26px;">
          <p style="margin:0;font-size:14px;color:#EDE3D4;"><strong style="color:#C5A880;">Founding &amp; Diamond members</strong> may also request a seat for one guest.</p>
        </div>
        <div style="text-align:center;margin:30px 0 34px;">
          <a href="${PAGE_URL}" style="display:inline-block;background:#C5A880;color:#1E0A0F;padding:15px 34px;text-decoration:none;border-radius:4px;font-weight:600;letter-spacing:0.5px;">Join the founding circle</a>
        </div>
        <p style="margin:0 0 30px;">With warmth,<br/>The Storm Wellness Club Team</p>
      </div>
      <div style="background:#140609;padding:22px;text-align:center;color:#C5A880;font-size:13px;">
        <p style="margin:0 0 6px;">Storm Wellness Club &middot; Members only</p>
        <p style="margin:0;">Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:#C5A880;">admin@stormwellnessclub.com</a></p>
      </div>
    </div>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireStaff(req, ["admin", "super_admin"]);
  if (!gate.ok) return gate.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* none */ }

  if (body?.preview) {
    return new Response(buildHtml("Jane"), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });

  // Eligible: active + frozen members only. Cancelled never included.
  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status, membership_type")
    .in("status", ["active", "frozen"]);
  if (memErr) return json({ error: memErr.message }, 500);

  const { data: sentRows } = await supabase
    .from("email_audit_log").select("recipient_email").eq("email_type", TEMPLATE_KEY).eq("status", "sent");
  const sentSet = new Set((sentRows ?? []).map((r: any) => String(r.recipient_email || "").toLowerCase()));

  // De-dupe by email.
  const byEmail = new Map<string, any>();
  for (const m of members ?? []) {
    const email = String(m.email || "").trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, { ...m, email });
  }

  if (body?.list) {
    const roster = [...byEmail.values()]
      .map((m) => ({
        email: m.email,
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email,
        tier: m.membership_type ?? null,
        status: m.status,
        already_sent: sentSet.has(m.email),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({ ok: true, roster });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);
  const resend = new Resend(resendKey);
  const triggeredBy = gate.userId === "service_role" ? null : gate.userId;

  if (body?.testEmail) {
    const email = String(body.testEmail).trim().toLowerCase();
    if (!(await isAllowedTestRecipient(req, email))) {
      return json({ error: "Test emails can only go to club addresses or your own email" }, 400);
    }
    const resp = await resend.emails.send({
      from: FROM, to: [email], subject: `[TEST] ${SUBJECT}`, html: buildHtml("Team"),
      reply_to: "admin@stormwellnessclub.com",
    });
    const err = (resp as any)?.error?.message ?? null;
    await supabase.from("email_audit_log").insert({
      recipient_email: email, email_type: TEST_TEMPLATE_KEY, trigger_source: "admin_test",
      triggered_by: triggeredBy, subject: `[TEST] ${SUBJECT}`, status: err ? "failed" : "sent", error_message: err,
    });
    return err ? json({ ok: false, error: err }, 500) : json({ ok: true, sentTo: email });
  }

  if (!body?.send) return json({ error: "Nothing to do" }, 400);

  const exclude = new Set<string>(
    (Array.isArray(body.excludeEmails) ? body.excludeEmails : []).map((e: unknown) => String(e).trim().toLowerCase()),
  );
  const resendAll = body.resend === true;

  let queued = 0, skipped = 0, removed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const m of byEmail.values()) {
    if (exclude.has(m.email)) { removed++; continue; }
    if (!resendAll && sentSet.has(m.email)) { skipped++; continue; }
    try {
      const resp = await resend.emails.send({
        from: FROM, to: [m.email], subject: SUBJECT, html: buildHtml(m.first_name ?? null),
        reply_to: "admin@stormwellnessclub.com",
      });
      const err = (resp as any)?.error?.message ?? null;
      await supabase.from("email_audit_log").insert({
        recipient_email: m.email,
        recipient_name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null,
        email_type: TEMPLATE_KEY, trigger_source: "admin_blast", triggered_by: triggeredBy,
        member_id: m.id, subject: SUBJECT, status: err ? "failed" : "sent", error_message: err,
      });
      if (err) errors.push({ email: m.email, error: err }); else queued++;
    } catch (e: any) {
      errors.push({ email: m.email, error: e?.message ?? String(e) });
    }
    await new Promise((r) => setTimeout(r, 550)); // stay under the email provider's rate limit
  }

  return json({ ok: true, queued, skipped, removed, failed: errors.length, errors: errors.slice(0, 20) });
});
