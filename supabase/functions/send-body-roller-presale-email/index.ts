// Body Roller presale campaign emails. Admin-only. Modes: preview, testEmail, else blast.
// launch/halfway/last_chance -> active members; arrived -> paid presale buyers. Idempotent per kind.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { isAllowedTestRecipient } from "../_shared/security.ts";
import { buildPresaleEmail, EMAIL_META, type EmailKind } from "../_shared/bodyRollerPresale.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireStaff(req, ["admin", "super_admin"]);
  if (!gate.ok) return gate.response;

  const body: any = await req.json().catch(() => ({}));
  const kind = body?.kind as EmailKind;
  if (!EMAIL_META[kind]) return json({ error: "Invalid email kind" }, 400);
  const meta = EMAIL_META[kind];

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: settings } = await supabase.from("body_roller_presale_settings").select("ends_at").eq("id", 1).maybeSingle();
  const endsLabel = new Date(settings?.ends_at ?? "2026-11-12T04:59:59Z").toLocaleDateString("en-US", {
    timeZone: "America/Detroit", weekday: "long", month: "long", day: "numeric",
  });

  if (body?.preview) {
    return new Response(buildPresaleEmail(kind, "Jane", endsLabel), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "RESEND_API_KEY not configured" }, 500);
  const resend = new Resend(key);
  const triggeredBy = gate.userId === "service_role" ? null : gate.userId;

  if (body?.testEmail) {
    const email = String(body.testEmail).trim().toLowerCase();
    if (!(await isAllowedTestRecipient(req, email))) return json({ error: "Test emails can only go to club addresses or your own email" }, 403);
    const resp: any = await resend.emails.send({ from: FROM, to: [email], subject: `[TEST] ${meta.subject}`, html: buildPresaleEmail(kind, "Team", endsLabel), reply_to: "admin@stormwellnessclub.com" });
    await supabase.from("email_audit_log").insert({ recipient_email: email, email_type: `${meta.key}_test`, trigger_source: "admin_test", triggered_by: triggeredBy, subject: `[TEST] ${meta.subject}`, status: resp?.error ? "failed" : "sent", error_message: resp?.error?.message ?? null });
    return resp?.error ? json({ ok: false, error: resp.error.message }) : json({ ok: true, sentTo: email });
  }

  // Recipients
  let recipients: { email: string; first: string | null; name: string | null; member_id: string | null }[] = [];
  if (kind === "arrived") {
    const { data } = await supabase.from("body_roller_presale_purchases").select("customer_email, customer_name, member_id").eq("status", "paid");
    const seen = new Set<string>();
    for (const r of data ?? []) {
      const e = String(r.customer_email || "").toLowerCase();
      if (!e || seen.has(e)) continue; seen.add(e);
      recipients.push({ email: e, first: (r.customer_name ?? "").split(" ")[0] || null, name: r.customer_name, member_id: r.member_id });
    }
  } else if (kind.startsWith("nm_")) {
    // Non-members: registered profiles with no member record at all (active or cancelled), minus blocked emails.
    const [{ data: profs, error }, { data: mems }, { data: blocked }] = await Promise.all([
      supabase.from("profiles").select("email, first_name, last_name").not("email", "is", null),
      supabase.from("members").select("email"),
      supabase.from("blocked_persons").select("email"),
    ]);
    if (error) return json({ error: error.message }, 500);
    const exclude = new Set([...(mems ?? []), ...(blocked ?? [])].map((r: any) => String(r.email || "").trim().toLowerCase()));
    const seen = new Set<string>();
    for (const p of profs ?? []) {
      const e = String((p as any).email || "").trim().toLowerCase();
      if (!e || exclude.has(e) || seen.has(e)) continue; seen.add(e);
      recipients.push({ email: e, first: (p as any).first_name ?? null, name: [(p as any).first_name, (p as any).last_name].filter(Boolean).join(" ") || null, member_id: null });
    }
  } else {
    const { data, error } = await supabase.from("members").select("id, first_name, last_name, email").eq("status", "active");
    if (error) return json({ error: error.message }, 500);
    recipients = (data ?? []).map((m: any) => ({ email: String(m.email || "").trim().toLowerCase(), first: m.first_name ?? null, name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null, member_id: m.id }));
  }

  const { data: sentRows } = await supabase.from("email_audit_log").select("recipient_email").eq("email_type", meta.key).eq("status", "sent");
  const already = new Set((sentRows ?? []).map((r: any) => String(r.recipient_email || "").toLowerCase()));

  let queued = 0, skipped = 0; const errors: any[] = [];
  for (const r of recipients) {
    if (!r.email || already.has(r.email)) { skipped++; continue; }
    try {
      const resp: any = await resend.emails.send({ from: FROM, to: [r.email], subject: meta.subject, html: buildPresaleEmail(kind, r.first, endsLabel), reply_to: "admin@stormwellnessclub.com" });
      const status = resp?.error ? "failed" : "sent";
      await supabase.from("email_audit_log").insert({ recipient_email: r.email, recipient_name: r.name, email_type: meta.key, trigger_source: "admin_blast", triggered_by: triggeredBy, member_id: r.member_id, subject: meta.subject, status, error_message: resp?.error?.message ?? null });
      if (status === "sent") { queued++; already.add(r.email); } else errors.push({ email: r.email, error: resp?.error?.message });
      await new Promise((res) => setTimeout(res, 550)); // stay under Resend rate limit
    } catch (e: any) { errors.push({ email: r.email, error: e?.message }); }
  }
  return json({ ok: true, queued, skipped, total: recipients.length, errors: errors.slice(0, 20) });
});
