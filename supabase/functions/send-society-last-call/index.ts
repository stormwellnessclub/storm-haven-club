// Higher Self Society last call: email + text to active/frozen members who have NOT signed up.
// Admin-only. Modes: list, preview, testEmail, testSms, sendEmail, sendSms.
// Email goes through _shared/marketingEmail.ts; texts go through send-sms (consent enforced, no bypass).
// Each person gets each message once (email_audit_log / sms idempotency key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { escapeHtml, isAllowedTestRecipient } from "../_shared/security.ts";
import { loadSuppressedEmails, marketingHeaders, withMarketingFooter } from "../_shared/marketingEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

let EMAIL_KEY = "higher_self_society_last_call_2026";
let SMS_KEY = "hss-last-call-2026";
let EYEBROW = "LAST CALL &middot; FOUNDING CIRCLE";
let BUTTON = "Save your seat";
const BASE_URL = "https://stormwellnessclub.com";
let PAGE_URL = `${BASE_URL}/rituals/higher-self-society`;
const HERO = `${BASE_URL}/__l5e/assets-v1/762dc417-e0d1-4d2a-ba3e-813f57319098/hss-shelf.jpg`;
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";
export const DEFAULT_SUBJECT = "Last call: Higher Self Society sign-ups close Sunday";
export const DEFAULT_MESSAGE =
  "Last call for Higher Self Society, our founding reading circle. Sign-ups close this Sunday, Oct. 18, and then members choose our first book together. We'll meet one Thursday evening a month, 7:00 to 9:00 PM.";
export const VOTE_SUBJECT = "Choose our first book: the Higher Self Society vote is open";
export const VOTE_MESSAGE =
  "The founding circle is set, and now you choose what we read first. We've shortlisted nine titles, from Atomic Habits to The Courage to Be Disliked. Each one has a short synopsis on the book club page.\n\nSign in with the email you used to join and tap Vote for this book. You can change your pick anytime before voting closes this Friday, Oct. 23 at 11:59 PM.";
const DEFAULT_SMS = `Storm Wellness Club: ${DEFAULT_MESSAGE} Save your seat: ${PAGE_URL} Reply STOP to opt out.`;

function buildHtml(firstName: string | null, message: string, hero: string = HERO): string {
  const greeting = firstName ? `Dear ${escapeHtml(firstName)},` : "Dear Member,";
  const paras = message.split(/\n\s*\n/).map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p.trim())}</p>`).join("");
  return `<html><body style="margin:0;background:#ffffff;">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;background:#1E0A0F;">
    <img src="${escapeHtml(hero)}" alt="Higher Self Society" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
    <div style="padding:36px 34px 10px;color:#FBF7F2;line-height:1.75;">
      <p style="color:#C5A880;font-family:Arial,sans-serif;letter-spacing:3px;font-size:11px;margin:0 0 10px;">${EYEBROW}</p>
      <h1 style="font-weight:400;margin:0 0 24px;font-size:32px;line-height:1.2;color:#FBF7F2;">Higher Self Society</h1>
      <p style="margin:0 0 16px;">${greeting}</p>
      ${paras}
      <div style="text-align:center;margin:30px 0 34px;">
        <a href="${PAGE_URL}" style="display:inline-block;background:#C5A880;color:#1E0A0F;padding:15px 34px;text-decoration:none;border-radius:4px;font-weight:600;">${BUTTON}</a>
      </div>
      <p style="margin:0 0 30px;">With warmth,<br/>The Storm Wellness Club Team</p>
    </div>
    <div style="background:#140609;padding:22px;text-align:center;color:#C5A880;font-size:13px;">
      Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:#C5A880;">admin@stormwellnessclub.com</a>
    </div>
  </div></body></html>`;
}

const digits = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireStaff(req, ["admin", "super_admin"]);
  if (!gate.ok) return gate.response;
  let body: any = {};
  try { body = await req.json(); } catch { /* none */ }

  const bookVote = body.audience === "book_vote";
  const signedUp = body.audience === "signed_up" || bookVote;
  PAGE_URL = `${BASE_URL}/rituals/higher-self-society`;
  EMAIL_KEY = bookVote ? "higher_self_society_book_vote_2026" : signedUp ? "higher_self_society_signed_up_update_2026" : "higher_self_society_last_call_2026";
  SMS_KEY = bookVote ? "hss-book-vote-2026" : signedUp ? "hss-signed-up-update-2026" : "hss-last-call-2026";
  EYEBROW = bookVote ? "FOUNDING CIRCLE &middot; THE BOOK VOTE" : signedUp ? "FOUNDING CIRCLE &middot; WHAT'S NEXT" : "LAST CALL &middot; FOUNDING CIRCLE";
  BUTTON = bookVote ? "Cast your vote" : signedUp ? "Visit Higher Self Society" : "Save your seat";
  if (bookVote) PAGE_URL = `${PAGE_URL}#book-vote`;
  const dSubject = bookVote ? VOTE_SUBJECT : DEFAULT_SUBJECT;
  const dMessage = bookVote ? VOTE_MESSAGE : DEFAULT_MESSAGE;
  const dSms = bookVote ? `Storm Wellness Club: Higher Self Society members, it's time to choose our first book. Voting closes Friday, Oct. 23 at 11:59 PM. Sign in to vote: ${PAGE_URL} Reply STOP to opt out.` : DEFAULT_SMS;
  const message = String(body.message ?? dMessage).trim().slice(0, 2000) || dMessage;
  const subject = String(body.subject ?? dSubject).trim().slice(0, 200) || dSubject;
  const smsText = String(body.smsText ?? dSms).trim().slice(0, 640) || dSms;

  let hero = HERO;
  const heroPath = typeof body.heroPath === "string" ? body.heroPath : "";
  if (/^society-last-call\/[\w.-]+\.(jpe?g|png)$/i.test(heroPath)) {
    const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: su } = await adm.storage.from("email-images").createSignedUrl(heroPath, 60 * 60 * 24 * 365 * 5);
    if (su?.signedUrl) hero = su.signedUrl;
  }
  if (body.defaults) return json({ ok: true, subject: dSubject, message: dMessage, smsText: dSms });
  if (body.preview) {
    return new Response(buildHtml("Jane", message, hero), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  }

  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const triggeredBy = gate.userId === "service_role" ? null : gate.userId;

  // Recipients: active + frozen members (never cancelled) who have not signed up.
  const members: any[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from("members")
      .select("id, user_id, first_name, last_name, email, phone, status").in("status", ["active", "frozen"]).range(f, f + 999);
    if (error) return json({ error: error.message }, 500);
    members.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const signed = new Set<string>(), signedUsers = new Set<string>();
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from("higher_self_society_interest").select("email, user_id").range(f, f + 999);
    for (const r of data ?? []) { if (r.email) signed.add(String(r.email).toLowerCase()); if (r.user_id) signedUsers.add(r.user_id); }
    if (!data || data.length < 1000) break;
  }
  const emailSent = new Set<string>();
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from("email_audit_log").select("recipient_email").eq("email_type", EMAIL_KEY).eq("status", "sent").range(f, f + 999);
    for (const r of data ?? []) emailSent.add(String(r.recipient_email || "").toLowerCase());
    if (!data || data.length < 1000) break;
  }
  const smsSent = new Set<string>();
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from("sms_messages").select("idempotency_key, status").like("idempotency_key", `${SMS_KEY}-%`).range(f, f + 999);
    for (const r of data ?? []) if (r.status !== "failed" && r.status !== "blocked_no_consent") smsSent.add(String(r.idempotency_key).slice(SMS_KEY.length + 1));
    if (!data || data.length < 1000) break;
  }
  const suppressed = await loadSuppressedEmails(sb);

  // Fill missing phones from profiles.
  const needPhone = members.filter((m) => !m.phone && m.user_id).map((m) => m.user_id);
  const profPhone = new Map<string, string>();
  for (let i = 0; i < needPhone.length; i += 300) {
    const { data } = await sb.from("profiles").select("user_id, phone").in("user_id", needPhone.slice(i, i + 300));
    for (const p of data ?? []) if (p.phone) profPhone.set(p.user_id, p.phone);
  }

  const byEmail = new Map<string, any>();
  if (signedUp) {
    for (let f = 0; ; f += 1000) {
      const { data } = await sb.from("higher_self_society_interest").select("id, user_id, full_name, email, phone").range(f, f + 999);
      for (const r of data ?? []) {
        const email = String(r.email || "").trim().toLowerCase();
        if (!email || byEmail.has(email)) continue;
        const [first_name, ...rest] = String(r.full_name || "").trim().split(/\s+/);
        const mem = members.find((m) => String(m.email || "").toLowerCase() === email);
        const phone = r.phone || mem?.phone || (r.user_id ? profPhone.get(r.user_id) : null) || null;
        byEmail.set(email, { id: mem?.id ?? null, user_id: r.user_id ?? mem?.user_id ?? null, first_name: first_name || null,
          last_name: rest.join(" ") || null, email, phone, status: mem?.status ?? "signed_up", phoneKey: digits(phone) });
      }
      if (!data || data.length < 1000) break;
    }
  }
  for (const m of signedUp ? [] : members) {
    const email = String(m.email || "").trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;
    if (signed.has(email) || (m.user_id && signedUsers.has(m.user_id))) continue;
    const phone = m.phone || (m.user_id ? profPhone.get(m.user_id) : null) || null;
    byEmail.set(email, { ...m, email, phone, phoneKey: digits(phone) });
  }
  const recipients = [...byEmail.values()].sort((a, b) =>
    `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`));

  if (body.list) {
    return json({
      ok: true,
      roster: recipients.map((m) => ({
        email: m.email,
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email,
        phone: m.phone, status: m.status,
        email_suppressed: suppressed.has(m.email),
        email_sent: emailSent.has(m.email),
        sms_sent: !!m.phoneKey && smsSent.has(m.phoneKey),
      })),
    });
  }

  const exclude = new Set<string>((Array.isArray(body.excludeEmails) ? body.excludeEmails : []).map((e: unknown) => String(e).trim().toLowerCase()));

  const sendSms = async (phone: string, userId: string | null, idem: string) => {
    const r = await fetch(`${url}/functions/v1/send-sms`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ templateKey: "admin-custom", idempotencyKey: idem, to: userId ? { userId, phone } : { phone },
        variables: { customBody: smsText }, metadata: { campaign: SMS_KEY } }),
    });
    const d = await r.json().catch(() => ({}));
    const blocked = d?.error === "no_consent" || d?.error === "blocked";
    return { ok: r.ok && d?.success !== false && !d?.error, blocked, status: blocked ? "blocked_no_consent" : d?.status, error: d?.error };
  };

  if (body.testSms) {
    const phone = digits(body.testSms);
    if (phone.length !== 10) return json({ error: "Enter a 10-digit phone number" }, 400);
    const r = await sendSms(phone, null, `${SMS_KEY}-test-${Date.now()}`);
    return r.ok ? json({ ok: true, status: r.status }) : json({ ok: false, error: r.blocked ? "That number hasn't agreed to texts from the club" : (r.error || "Text not sent") });
  }

  if (body.sendSms) {
    let sent = 0, skipped = 0, failed = 0, removed = 0;
    const seen = new Set<string>();
    for (const m of recipients) {
      if (exclude.has(m.email)) { removed++; continue; }
      if (!m.phoneKey || m.phoneKey.length !== 10 || seen.has(m.phoneKey) || smsSent.has(m.phoneKey)) { skipped++; continue; }
      seen.add(m.phoneKey);
      const r = await sendSms(m.phoneKey, m.user_id ?? null, `${SMS_KEY}-${m.phoneKey}`);
      if (r.ok) sent++; else if (r.blocked) skipped++; else failed++;
    }
    return json({ ok: true, sent, skipped, failed, removed });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);
  const resend = new Resend(resendKey);

  if (body.testEmail) {
    const email = String(body.testEmail).trim().toLowerCase();
    if (!(await isAllowedTestRecipient(req, email))) return json({ error: "Test emails can only go to club addresses or your own email" }, 400);
    const resp = await resend.emails.send({ from: FROM, to: [email], subject: `[TEST] ${subject}`,
      html: await withMarketingFooter(buildHtml("Team", message, hero), email), reply_to: "admin@stormwellnessclub.com",
      headers: await marketingHeaders(email) } as any);
    const err = (resp as any)?.error?.message ?? null;
    await sb.from("email_audit_log").insert({ recipient_email: email, email_type: `${EMAIL_KEY}_test`, trigger_source: "admin_test",
      triggered_by: triggeredBy, subject: `[TEST] ${subject}`, status: err ? "failed" : "sent", error_message: err });
    return err ? json({ ok: false, error: err }) : json({ ok: true, sentTo: email });
  }

  if (!body.sendEmail) return json({ error: "Nothing to do" }, 400);
  let queued = 0, skipped = 0, removed = 0, failed = 0;
  for (const m of recipients) {
    if (exclude.has(m.email)) { removed++; continue; }
    if (emailSent.has(m.email) || suppressed.has(m.email)) { skipped++; continue; }
    try {
      const resp = await resend.emails.send({ from: FROM, to: [m.email], subject,
        html: await withMarketingFooter(buildHtml(m.first_name ?? null, message, hero), m.email),
        reply_to: "admin@stormwellnessclub.com", headers: await marketingHeaders(m.email) } as any);
      const err = (resp as any)?.error?.message ?? null;
      await sb.from("email_audit_log").insert({ recipient_email: m.email,
        recipient_name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null,
        email_type: EMAIL_KEY, trigger_source: "admin_blast", triggered_by: triggeredBy, member_id: m.id,
        subject, status: err ? "failed" : "sent", error_message: err });
      if (err) failed++; else queued++;
    } catch { failed++; }
    await new Promise((r) => setTimeout(r, 550));
  }
  return json({ ok: true, queued, skipped, removed, failed });
});
