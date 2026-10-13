// Body Roller presale campaign emails. Admin-only. Modes: preview, testEmail, else blast.
// launch/halfway/last_chance -> active members; arrived -> paid presale buyers. Idempotent per kind.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { isAllowedTestRecipient } from "../_shared/security.ts";
import { buildPresaleEmail, EMAIL_META, type EmailKind } from "../_shared/bodyRollerPresale.ts";
import { trackLinks } from "../_shared/bodyRollerClick.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";
// One-click unsubscribe + plain-text copy: both are inbox-placement signals Gmail/Yahoo check for bulk mail.
const UNSUB_HEADERS = { "List-Unsubscribe": "<mailto:admin@stormwellnessclub.com?subject=Unsubscribe>" };
const toText = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&mdash;/g, "—")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

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
    const resp: any = await resend.emails.send({ from: FROM, to: [email], subject: `[TEST] ${meta.subject}`, html: buildPresaleEmail(kind, "Team", endsLabel), text: toText(buildPresaleEmail(kind, "Team", endsLabel)), headers: UNSUB_HEADERS, reply_to: "admin@stormwellnessclub.com" });
    await supabase.from("email_audit_log").insert({ recipient_email: email, email_type: `${meta.key}_test`, trigger_source: "admin_test", triggered_by: triggeredBy, subject: `[TEST] ${meta.subject}`, status: resp?.error ? "failed" : "sent", error_message: resp?.error?.message ?? null });
    return resp?.error ? json({ ok: false, error: resp.error.message }) : json({ ok: true, sentTo: email });
  }

  const norm = (e: any) => String(e || "").trim().toLowerCase();
  const pageAllRows = async (table: string, cols: string, apply?: (q: any) => any) => {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from(table).select(cols).range(from, from + 999);
      if (apply) q = apply(q);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  // Funnel: who clicked, who opened checkout without paying, who bought — split member / non-member.
  const loadFunnel = async () => {
    const [clicks, purchases, mems, blocked, unsub, logs] = await Promise.all([
      pageAllRows("body_roller_presale_clicks", "email, clicked_at"),
      pageAllRows("body_roller_presale_purchases", "customer_email, status, created_at"),
      pageAllRows("members", "email, status, first_name, last_name"),
      pageAllRows("blocked_persons", "email"),
      pageAllRows("marketing_contacts", "email", (q: any) => q.not("unsubscribed_at", "is", null)),
      pageAllRows("email_audit_log", "recipient_email, email_type", (q: any) => q.eq("status", "sent").like("email_type", "body_roller_presale_%")),
    ]);
    const activeMembers = new Map<string, any>();
    for (const m of mems) if (m.status !== "cancelled" && norm(m.email)) activeMembers.set(norm(m.email), m);
    const bought = new Set(purchases.filter((r: any) => r.status === "paid" || r.status === "processing").map((r: any) => norm(r.customer_email)));
    const hourAgo = Date.now() - 3600_000;
    const started = new Set(purchases.map((r: any) => norm(r.customer_email)));
    const abandoned = new Set(purchases.filter((r: any) => r.status === "pending" && new Date(r.created_at).getTime() < hourAgo).map((r: any) => norm(r.customer_email)).filter((e: string) => !bought.has(e)));
    const clicked = new Set(clicks.map((c: any) => norm(c.email)));
    const clickedOnly = new Set([...clicked].filter((e) => !bought.has(e) && !started.has(e)));
    const no = new Set([...blocked, ...unsub].map((r: any) => norm(r.email)));
    const emailed = new Set(logs.filter((l: any) => !String(l.email_type).endsWith("_test") && !String(l.email_type).includes("followup") && !String(l.email_type).endsWith("_arrived")).map((l: any) => norm(l.recipient_email)));
    const split = (set: Set<string>) => ({ member: [...set].filter((e) => activeMembers.has(e)).length, non_member: [...set].filter((e) => !activeMembers.has(e)).length });
    return { activeMembers, clickedOnly, abandoned, no, funnel: {
      emailed: split(emailed), clicked: split(clicked), started: split(started), bought: split(bought),
      clicked_not_started: split(clickedOnly), abandoned: split(abandoned),
    } };
  };
  if (body?.funnel) {
    try { return json({ ok: true, ...(await loadFunnel()).funnel }); } catch (e: any) { return json({ error: e?.message }, 500); }
  }

  // Recipients
  let recipients: { email: string; first: string | null; name: string | null; member_id: string | null; source?: string }[] = [];
  if (kind === "arrived") {
    const { data } = await supabase.from("body_roller_presale_purchases").select("customer_email, customer_name, member_id").eq("status", "paid");
    const seen = new Set<string>();
    for (const r of data ?? []) {
      const e = String(r.customer_email || "").toLowerCase();
      if (!e || seen.has(e)) continue; seen.add(e);
      recipients.push({ email: e, first: (r.customer_name ?? "").split(" ")[0] || null, name: r.customer_name, member_id: r.member_id, source: "buyer" });
    }
  } else if (kind.includes("followup_")) {
    try {
      const f = await loadFunnel();
      const wantMember = !kind.startsWith("nm_");
      const src = kind.endsWith("clicked") ? f.clickedOnly : f.abandoned;
      const { data: pending } = await supabase.from("body_roller_presale_purchases").select("customer_email, customer_name").eq("status", "pending");
      const names = new Map((pending ?? []).map((r: any) => [norm(r.customer_email), r.customer_name]));
      for (const e of src) {
        if (!e.includes("@") || f.no.has(e) || f.activeMembers.has(e) !== wantMember) continue;
        const m = f.activeMembers.get(e);
        const name = m ? [m.first_name, m.last_name].filter(Boolean).join(" ") : (names.get(e) ?? null);
        recipients.push({ email: e, first: m?.first_name ?? (name ? String(name).split(" ")[0] : null), name: name || null, member_id: null, source: kind.endsWith("clicked") ? "clicked" : "abandoned" });
      }
    } catch (e: any) { return json({ error: e?.message ?? "Failed to load recipients" }, 500); }
  } else if (kind.startsWith("nm_")) {
    // Non-members: imported contacts + non-member accounts + registered profiles, de-duplicated,
    // minus anyone with a current (non-cancelled) membership, blocked, or unsubscribed. Paged — no 1,000 cap.
    const pageAll = async (table: string, cols: string, apply?: (q: any) => any) => {
      const out: any[] = [];
      for (let from = 0; ; from += 1000) {
        let q = supabase.from(table).select(cols).range(from, from + 999);
        if (apply) q = apply(q);
        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    };
    try {
      const [contacts, nonMembers, profs, mems, blocked] = await Promise.all([
        pageAll("marketing_contacts", "email, first_name, last_name, unsubscribed_at, opted_in_email"),
        pageAll("non_member_profiles", "email, first_name, last_name"),
        pageAll("profiles", "email, first_name, last_name"),
        pageAll("members", "email, status"),
        pageAll("blocked_persons", "email"),
      ]);
      const norm = (e: any) => String(e || "").trim().toLowerCase();
      const exclude = new Set<string>([
        ...mems.filter((m: any) => m.status !== "cancelled").map((m: any) => norm(m.email)),
        ...blocked.map((b: any) => norm(b.email)),
        ...contacts.filter((c: any) => c.unsubscribed_at || c.opted_in_email === false).map((c: any) => norm(c.email)),
      ]);
      const counts = { imported: 0, portal_accounts: 0, other_accounts: 0 };
      const seen = new Set<string>();
      const add = (rows: any[], src: keyof typeof counts) => {
        for (const p of rows) {
          const e = norm(p.email);
          if (!e || !e.includes("@") || exclude.has(e) || seen.has(e)) continue;
          seen.add(e); counts[src]++;
          recipients.push({ email: e, first: p.first_name ?? null, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null, member_id: null, source: src });
        }
      };
      add(contacts, "imported"); add(nonMembers, "portal_accounts"); add(profs, "other_accounts");
      (body as any)._counts = counts;
    } catch (e: any) {
      return json({ error: e?.message ?? "Failed to load recipients" }, 500);
    }
  } else {
    const { data, error } = await supabase.from("members").select("id, first_name, last_name, email").eq("status", "active");
    if (error) return json({ error: error.message }, 500);
    recipients = (data ?? []).map((m: any) => ({ email: String(m.email || "").trim().toLowerCase(), first: m.first_name ?? null, name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null, member_id: m.id, source: "member" }));
  }
  // Extra people the admin added by hand (still never blocked or unsubscribed addresses).
  const extras: string[] = Array.isArray(body?.extraEmails)
    ? [...new Set(body.extraEmails.map((e: any) => String(e || "").trim().toLowerCase()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 500) as string[]
    : [];
  if (extras.length) {
    const [{ data: bl }, { data: unsub }] = await Promise.all([
      supabase.from("blocked_persons").select("email").in("email", extras),
      supabase.from("marketing_contacts").select("email").in("email", extras).not("unsubscribed_at", "is", null),
    ]);
    const no = new Set([...(bl ?? []), ...(unsub ?? [])].map((r: any) => String(r.email).toLowerCase()));
    const have = new Set(recipients.map((r) => r.email));
    for (const e of extras) if (!no.has(e) && !have.has(e)) { recipients.push({ email: e, first: null, name: null, member_id: null, source: "added" }); have.add(e); }
  }
  if (body?.countOnly) return json({ ok: true, total: recipients.length, counts: (body as any)._counts });

  const { data: sentRows } = await supabase.from("email_audit_log").select("recipient_email").eq("email_type", meta.key).eq("status", "sent");
  const already = new Set((sentRows ?? []).map((r: any) => String(r.recipient_email || "").toLowerCase()));

  if (body?.listOnly) {
    return json({ ok: true, total: recipients.length, recipients: recipients.map((r) => ({ email: r.email, name: r.name, source: r.source ?? null, already_sent: already.has(r.email) })) });
  }

  let queued = 0, skipped = 0; const errors: any[] = [];
  for (const r of recipients) {
    if (!r.email || already.has(r.email)) { skipped++; continue; }
    try {
      const built = buildPresaleEmail(kind, r.first, endsLabel);
      const resp: any = await resend.emails.send({ from: FROM, to: [r.email], subject: meta.subject, html: await trackLinks(built, r.email, kind), text: toText(built), reply_to: "admin@stormwellnessclub.com", headers: UNSUB_HEADERS });
      const status = resp?.error ? "failed" : "sent";
      await supabase.from("email_audit_log").insert({ recipient_email: r.email, recipient_name: r.name, email_type: meta.key, trigger_source: "admin_blast", triggered_by: triggeredBy, member_id: r.member_id, subject: meta.subject, status, error_message: resp?.error?.message ?? null });
      if (status === "sent") { queued++; already.add(r.email); } else errors.push({ email: r.email, error: resp?.error?.message });
      await new Promise((res) => setTimeout(res, 550)); // stay under Resend rate limit
    } catch (e: any) { errors.push({ email: r.email, error: e?.message }); }
  }
  return json({ ok: true, queued, skipped, total: recipients.length, errors: errors.slice(0, 20) });
});
