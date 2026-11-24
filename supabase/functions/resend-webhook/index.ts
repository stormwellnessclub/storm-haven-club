// Public webhook from the email service (delivered / bounced / complained).
// We never trust the posted body: each event is re-checked by fetching the email from the provider's API.
// Campaign emails get delivery results; permanent bounces and spam complaints stop future marketing email
// to that address (marketing_contacts.opted_in_email = false), which every campaign already skips.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const EVENTS: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  try {
    const body = await req.json().catch(() => null);
    const kind = EVENTS[String(body?.type ?? "")];
    const emailId = String(body?.data?.email_id ?? "");
    if (!kind || !/^[0-9a-f-]{36}$/i.test(emailId)) return json({ ok: true, ignored: true });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ ok: false }, 500);
    const r = await fetch(`https://api.resend.com/emails/${emailId}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return json({ ok: true, unverified: true });
    const em = await r.json();
    const last = String(em?.last_event ?? "");
    const to = String((Array.isArray(em?.to) ? em.to[0] : em?.to) ?? "").trim().toLowerCase();
    if (!to.includes("@")) return json({ ok: true });
    // The provider's own record must agree with the event (delivered may later become opened/complained).
    const verified = kind === "delivered" ? ["delivered", "opened", "clicked", "complained"].includes(last) : last === kind;
    if (!verified) return json({ ok: true, unverified: true });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: log } = await sb.from("email_audit_log").select("email_type").eq("provider_message_id", emailId).limit(1).maybeSingle();
    const m = /^campaign_([0-9a-f-]{36})$/i.exec(String(log?.email_type ?? ""));
    const bounceType = String(body?.data?.bounce?.type ?? "");
    if (m) {
      await sb.rpc("record_marketing_email_event", { p_campaign_id: m[1], p_email: to, p_event: kind,
        p_detail: kind === "bounced" ? (bounceType || null) : null, p_at: body?.created_at ?? null });
    }
    const permanent = kind === "complained" || (kind === "bounced" && !/transient|temporary/i.test(bounceType));
    if (permanent) {
      const reason = kind === "complained" ? "marked as spam" : "email bounced";
      const { data: existing } = await sb.from("marketing_contacts").select("id, external_metadata").ilike("email", to).limit(1).maybeSingle();
      const meta = { ...(existing?.external_metadata ?? {}), email_stopped_reason: reason, email_stopped_at: new Date().toISOString() };
      if (existing) await sb.from("marketing_contacts").update({ opted_in_email: false, external_metadata: meta }).eq("id", existing.id);
      else await sb.from("marketing_contacts").insert({ email: to, opted_in_email: false, source_label: "Email stopped automatically", external_metadata: meta });
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[resend-webhook]", e);
    return json({ ok: false }, 500);
  }
});
