// Campaign Studio: one sender for every marketing email and text.
// Actions: audiences, preview, test_email, test_sms, send, run_scheduled (internal timer), ai_draft.
// Email always goes through _shared/marketingEmail.ts (unsubscribe link + headers + suppression).
// Texts always go through send-sms (consent enforced; account opt-out wins). Never bypassConsent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { isValidInternalToken, presentedInternalToken } from "../_shared/internalTaskToken.ts";
import { isAllowedTestRecipient } from "../_shared/security.ts";
import { loadSuppressedEmails, marketingHeaders, withMarketingFooter } from "../_shared/marketingEmail.ts";
import { blocksText, brandIssues, renderCampaignHtml, type Block } from "../_shared/campaignRender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const digits = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);

type Person = { email: string; first_name: string | null; last_name: string | null; phone: string | null; user_id: string | null; member_id: string | null };

export const AUDIENCES: Record<string, string> = {
  hss_roster: "Higher Self Society roster",
  hss_no_rsvp: "Higher Self Society: no RSVP yet (Dec 3)",
  hss_rsvp_yes: "Higher Self Society: RSVP'd yes (Dec 3)",
  active_members: "Active and frozen members",
  non_members: "Non-members with an account",
  email_list: "Everyone on the email list",
};

async function pageAll(sb: any, table: string, cols: string, apply: (q: any) => any = (q) => q) {
  const out: any[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await apply(sb.from(table).select(cols)).range(f, f + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadAudience(sb: any, key: string): Promise<Person[]> {
  const by = new Map<string, Person>();
  const add = (p: Person) => { const e = norm(p.email); if (e && !by.has(e)) by.set(e, { ...p, email: e }); };
  const members = await pageAll(sb, "members", "id, user_id, first_name, last_name, email, phone, status", (q) => q.in("status", ["active", "frozen"]));
  const memberByEmail = new Map(members.map((m: any) => [norm(m.email), m]));

  if (key.startsWith("hss_")) {
    const rows = await pageAll(sb, "higher_self_society_interest", "user_id, full_name, email, phone");
    let keep: ((r: any) => boolean) = () => true;
    if (key !== "hss_roster") {
      const rs = await pageAll(sb, "society_meeting_rsvps", "user_id, response", (q) => q.eq("round_key", "round-1"));
      const replied = new Set(rs.map((r: any) => r.user_id));
      const yes = new Set(rs.filter((r: any) => r.response === "yes").map((r: any) => r.user_id));
      keep = key === "hss_no_rsvp" ? (r) => !r.user_id || !replied.has(r.user_id) : (r) => !!r.user_id && yes.has(r.user_id);
    }
    for (const r of rows) {
      if (!keep(r)) continue;
      const m: any = memberByEmail.get(norm(r.email));
      const [first, ...rest] = String(r.full_name || "").trim().split(/\s+/);
      add({ email: r.email, first_name: first || m?.first_name || null, last_name: rest.join(" ") || m?.last_name || null,
        phone: r.phone || m?.phone || null, user_id: r.user_id || m?.user_id || null, member_id: m?.id ?? null });
    }
  } else if (key === "active_members") {
    for (const m of members) add({ email: m.email, first_name: m.first_name, last_name: m.last_name, phone: m.phone, user_id: m.user_id, member_id: m.id });
  } else if (key === "non_members") {
    const rows = await pageAll(sb, "non_member_profiles", "user_id, first_name, last_name, email, phone", (q) => q.is("merged_into_user_id", null));
    for (const r of rows) if (!memberByEmail.has(norm(r.email))) add({ ...r, member_id: null });
  } else if (key === "email_list") {
    const rows = await pageAll(sb, "marketing_contacts", "email, first_name, last_name, phone", (q) => q.eq("opted_in_email", true).is("unsubscribed_at", null));
    for (const r of rows) add({ ...r, user_id: null, member_id: null });
    for (const m of members) add({ email: m.email, first_name: m.first_name, last_name: m.last_name, phone: m.phone, user_id: m.user_id, member_id: m.id });
  } else {
    throw new Error("Unknown audience");
  }
  // Fill phones from profiles for account holders.
  const need = [...by.values()].filter((p) => !p.phone && p.user_id).map((p) => p.user_id!);
  const phones = new Map<string, string>();
  for (let i = 0; i < need.length; i += 300) {
    const { data } = await sb.from("profiles").select("user_id, phone").in("user_id", need.slice(i, i + 300));
    for (const p of data ?? []) if (p.phone) phones.set(p.user_id, p.phone);
  }
  return [...by.values()].map((p) => ({ ...p, phone: p.phone || (p.user_id ? phones.get(p.user_id) ?? null : null) }));
}

async function sendSms(url: string, key: string, phone: string, userId: string | null, idem: string, text: string, media?: string | null) {
  const r = await fetch(`${url}/functions/v1/send-sms`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ templateKey: "admin-custom", idempotencyKey: idem, to: userId ? { userId, phone } : { phone },
      variables: { customBody: text }, metadata: { campaign: idem.split(":")[0] }, ...(media ? { mediaUrls: [media] } : {}) }),
  });
  const d = await r.json().catch(() => ({}));
  const blocked = d?.error === "no_consent" || d?.error === "blocked";
  return { ok: r.ok && d?.success !== false && !d?.error, blocked, error: d?.error };
}

const smsWithStop = (t: string) => /reply stop/i.test(t) ? t : `${t.trim()} Reply STOP to opt out.`;

async function runCampaign(sb: any, c: any, triggeredBy: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  await sb.from("marketing_campaigns").update({ status: "sending", last_error: null }).eq("id", c.id);
  const people = await loadAudience(sb, c.audience_key);
  const emailType = `campaign_${c.id}`;
  const stats: any = { audience: people.length, email: { sent: 0, skipped: 0, failed: 0 }, sms: { sent: 0, skipped: 0, failed: 0 } };
  try {
    if (c.send_email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("Email service is not configured");
      const resend = new Resend(resendKey);
      const suppressed = await loadSuppressedEmails(sb);
      const done = new Set((await pageAll(sb, "email_audit_log", "recipient_email", (q) => q.eq("email_type", emailType).eq("status", "sent"))).map((r: any) => norm(r.recipient_email)));
      for (const p of people) {
        if (suppressed.has(p.email) || done.has(p.email)) { stats.email.skipped++; continue; }
        try {
          const resp = await resend.emails.send({ from: FROM, to: [p.email], subject: c.subject,
            html: await withMarketingFooter(renderCampaignHtml(c.blocks, { firstName: p.first_name, preheader: c.preheader }), p.email),
            reply_to: "admin@stormwellnessclub.com", headers: await marketingHeaders(p.email) } as any);
          const err = (resp as any)?.error?.message ?? null;
          await sb.from("email_audit_log").insert({ recipient_email: p.email, recipient_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
            email_type: emailType, trigger_source: "campaign_studio", triggered_by: triggeredBy, member_id: p.member_id,
            subject: c.subject, status: err ? "failed" : "sent", error_message: err });
          if (err) stats.email.failed++; else stats.email.sent++;
        } catch { stats.email.failed++; }
        await new Promise((r) => setTimeout(r, 550));
      }
    }
    if (c.send_sms && c.sms_body) {
      const seen = new Set<string>();
      const text = smsWithStop(`Storm Wellness Club: ${c.sms_body.replace(/^storm wellness club:\s*/i, "")}`);
      for (const p of people) {
        const ph = digits(p.phone);
        if (ph.length !== 10 || seen.has(ph)) { stats.sms.skipped++; continue; }
        seen.add(ph);
        const r = await sendSms(url, key, ph, p.user_id, `mkt-${c.id}:${ph}`, text, c.sms_image_url);
        if (r.ok) stats.sms.sent++; else if (r.blocked) stats.sms.skipped++; else stats.sms.failed++;
      }
    }
    await sb.from("marketing_campaigns").update({ status: "sent", sent_at: new Date().toISOString(), stats }).eq("id", c.id);
    return stats;
  } catch (e) {
    await sb.from("marketing_campaigns").update({ status: "failed", stats, last_error: String((e as Error).message) }).eq("id", c.id);
    throw e;
  }
}

const BRAND_RULES = `You write marketing for Storm Wellness Club, a premium training, recovery and spa club in Livonia, Michigan (serving Livonia, Northville, Plymouth, Dearborn, Novi, Canton, Farmington Hills).
Voice: confident, restrained, editorial, human, concise. Premium through precision, not adjectives. Always write "Storm Wellness Club" in full. Anchor line: "Built with intention. Guided by science."
Never use: the word "free", "buy tickets", sanctuary, "your body called", "you deserve this", "unleash your potential", generic wellness slogans, emojis, more than one exclamation point, aggressive sales language, gendered defaults, founder first-person, medical claims.
The reading circle is always called "Higher Self Society", never "book club".
Only Reformer and aerobics/studio classes are launched; never present cycling or yoga as available. Grip socks are required for classes.
Address readers warmly; you may use {first_name}. Sign-off is added automatically, don't write one. Texts: under 300 characters, plain, no emojis, include one link if provided.`;

const DRAFT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "subject_options", "preheader", "eyebrow", "heading", "body", "button_label", "sms"],
  properties: {
    name: { type: "string" }, subject_options: { type: "array", items: { type: "string" } }, preheader: { type: "string" },
    eyebrow: { type: "string" }, heading: { type: "string" }, body: { type: "string", description: "Paragraphs separated by blank lines" },
    button_label: { type: "string" }, sms: { type: "string" },
  },
};

async function aiDraft(goal: string, current: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
      instructions: BRAND_RULES,
      input: [{ role: "user", content: `Campaign goal: ${goal}\n${current ? `Current draft to improve:\n${current}\n` : ""}Write one email (3 subject line options) and a matching text message.` }],
      text: { format: { type: "json_schema", name: "campaign_draft", strict: true, schema: DRAFT_SCHEMA } },
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    const msg = resp.status === 402 ? "AI credits have run out. Add credits in Settings, then try again." :
      resp.status === 429 ? "AI is busy right now. Try again in a minute." : `AI request failed (${resp.status}) ${t.slice(0, 200)}`;
    const e = new Error(msg); (e as any).status = resp.status; throw e;
  }
  const reader = resp.body.getReader(); const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim(); if (!d || d === "[DONE]") continue;
      try { const ev = JSON.parse(d); if (ev.type === "response.output_text.delta") out += ev.delta ?? ""; } catch { /* skip */ }
    }
  }
  if (!out) throw new Error("The AI didn't return a draft. Try describing the goal differently.");
  return JSON.parse(out);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  try {
    const presented = presentedInternalToken(req);
    if (presented) {
      if (!(await isValidInternalToken(presented)) || body.action !== "run_scheduled") return json({ error: "Forbidden" }, 403);
      const { data: c } = await sb.from("marketing_campaigns").select("*").eq("id", body.id).maybeSingle();
      if (!c || c.status !== "scheduled") return json({ ok: false, skipped: "not scheduled" });
      return json({ ok: true, stats: await runCampaign(sb, c, null) });
    }

    const gate = await requireStaff(req, ["super_admin", "admin", "manager"]);
    if (!gate.ok) return gate.response;
    const uid = gate.userId === "service_role" ? null : gate.userId;

    switch (body.action) {
      case "audiences": {
        const out: any[] = [];
        for (const [k, label] of Object.entries(AUDIENCES)) {
          const people = await loadAudience(sb, k);
          out.push({ key: k, label, count: people.length, withPhone: people.filter((p) => digits(p.phone).length === 10).length });
        }
        return json({ ok: true, audiences: out });
      }
      case "preview": {
        const blocks: Block[] = Array.isArray(body.blocks) ? body.blocks : [];
        const issues = brandIssues(`${body.subject ?? ""}\n${body.preheader ?? ""}\n${blocksText(blocks)}\n${body.sms ?? ""}`);
        return json({ ok: true, html: renderCampaignHtml(blocks, { firstName: "Jane", preheader: body.preheader }), issues });
      }
      case "test_email": {
        const email = norm(body.email);
        if (!(await isAllowedTestRecipient(req, email))) return json({ ok: false, error: "Tests can only go to club addresses or your own email" });
        const resendKey = Deno.env.get("RESEND_API_KEY"); if (!resendKey) return json({ ok: false, error: "Email service is not configured" });
        const resp = await new Resend(resendKey).emails.send({ from: FROM, to: [email], subject: `[TEST] ${body.subject || "Campaign"}`,
          html: await withMarketingFooter(renderCampaignHtml(body.blocks ?? [], { firstName: "Team", preheader: body.preheader }), email),
          reply_to: "admin@stormwellnessclub.com", headers: await marketingHeaders(email) } as any);
        const err = (resp as any)?.error?.message ?? null;
        await sb.from("email_audit_log").insert({ recipient_email: email, email_type: "campaign_test", trigger_source: "campaign_studio",
          triggered_by: uid, subject: `[TEST] ${body.subject ?? ""}`, status: err ? "failed" : "sent", error_message: err });
        return json(err ? { ok: false, error: err } : { ok: true });
      }
      case "test_sms": {
        const ph = digits(body.phone);
        if (ph.length !== 10) return json({ ok: false, error: "Enter a 10-digit phone number" });
        const text = smsWithStop(`Storm Wellness Club: ${String(body.sms ?? "").replace(/^storm wellness club:\s*/i, "")}`);
        const r = await sendSms(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ph, null, `mkt-test-${Date.now()}:${ph}`, text, body.image ?? null);
        return json(r.ok ? { ok: true } : { ok: false, error: r.blocked ? "That number hasn't agreed to texts from the club" : (r.error || "Text not sent") });
      }
      case "send": {
        const { data: c } = await sb.from("marketing_campaigns").select("*").eq("id", body.id).maybeSingle();
        if (!c) return json({ ok: false, error: "Campaign not found" });
        if (c.status === "sent" || c.status === "sending") return json({ ok: false, error: "This campaign was already sent" });
        if (!c.subject && c.send_email) return json({ ok: false, error: "Add a subject first" });
        return json({ ok: true, stats: await runCampaign(sb, c, uid) });
      }
      case "ai_draft": {
        const goal = String(body.goal ?? "").trim().slice(0, 1500);
        if (!goal) return json({ ok: false, error: "Describe what this campaign is for" });
        return json({ ok: true, draft: await aiDraft(goal, String(body.current ?? "").slice(0, 4000)) });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("campaign-studio", e);
    return json({ ok: false, error: String((e as Error).message ?? e) });
  }
});
