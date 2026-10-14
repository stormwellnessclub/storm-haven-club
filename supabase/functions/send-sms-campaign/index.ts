// Targeted SMS campaigns: send now, schedule, or cancel. Staff only (or service role from the scheduler).
// Consent is always enforced: each text goes through send-sms without bypassConsent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = /^[0-9a-f-]{36}$/i;

function render(body: string, v: Record<string, string>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => v[k] ?? "");
}

async function runCampaign(sb: any, id: string) {
  const { data: c } = await sb.from("sms_campaigns").select("*").eq("id", id).single();
  if (!c) throw new Error("Campaign not found");
  const ids: string[] = c.recipient_user_ids ?? [];
  const profs: any[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb.from("profiles").select("user_id, first_name, last_name, phone").in("user_id", ids.slice(i, i + 300));
    profs.push(...(data ?? []));
  }
  const contacts: any[] = Array.isArray(c.recipient_contacts) ? c.recipient_contacts : [];
  // Already handled in an earlier run of this campaign (long lists continue in the background).
  const done = new Set<string>();
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from("sms_campaign_recipients").select("phone").eq("campaign_id", id).range(f, f + 999);
    for (const r of data ?? []) done.add(String(r.phone ?? "").replace(/\D/g, "").slice(-10));
    if (!data || data.length < 1000) break;
  }
  let sent = 0, failed = 0, skipped = 0, remaining = 0;
  const seen = new Set<string>(done);
  const all = [
    ...profs.map((p) => ({ key: p.user_id, userId: p.user_id, phone: p.phone, first: p.first_name, last: p.last_name })),
    ...contacts.map((x) => ({ key: `c-${String(x.phone ?? "").replace(/\D/g, "").slice(-10)}`, userId: null, phone: x.phone, first: x.first_name, last: x.last_name })),
  ];
  const list = all.filter((p) => {
    const tail = String(p.phone ?? "").replace(/\D/g, "").slice(-10);
    if (tail.length < 10 || seen.has(tail)) { if (!done.has(tail)) skipped++; return false; }
    seen.add(tail); return true;
  });
  const started = Date.now();
  for (let i = 0; i < list.length; i += 10) {
    if (Date.now() - started > 100_000) { remaining = list.length - i; break; }
    const batch = list.slice(i, i + 10);
    await Promise.all(batch.map(async (p: any) => {
      const text = render(c.body ?? "", { first_name: p.first ?? "there", name: p.first ?? "there" });
      let status = "failed", sid: string | null = null, err: string | null = null;
      try {
        const r = await fetch(`${URL_}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({
            to: p.userId ? { userId: p.userId, phone: p.phone } : { phone: p.phone },
            templateKey: "admin-custom",
            variables: { customBody: text },
            idempotencyKey: `campaign-${id}-${p.key}`,
            metadata: { source: "targeted_campaign", campaign_id: id },
            mediaUrls: c.media_urls ?? [],
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.success !== false) { status = "sent"; sid = d?.twilio_sid ?? d?.sid ?? null; sent++; }
        else { err = d?.error ?? `HTTP ${r.status}`; if (err === "no_consent" || err === "blocked") { status = "skipped"; skipped++; } else failed++; }
      } catch (e: any) { err = e?.message ?? "error"; failed++; }
      await sb.from("sms_campaign_recipients").insert({
        campaign_id: id, recipient_user_id: p.userId, phone: p.phone,
        recipient_name: `${p.first ?? ""} ${p.last ?? ""}`.trim(),
        status, twilio_sid: sid, error_message: err, sent_at: new Date().toISOString(),
      });
    }));
  }
  const tot = {
    sent_count: (c.status === "sending" && done.size ? c.sent_count ?? 0 : 0) + sent,
    failed_count: (c.status === "sending" && done.size ? c.failed_count ?? 0 : 0) + failed,
    skipped_count: (c.status === "sending" && done.size ? c.skipped_count ?? 0 : 0) + skipped,
  };
  if (remaining > 0) {
    await sb.from("sms_campaigns").update({ status: "sending", ...tot }).eq("id", id);
    const next = fetch(`${URL_}/functions/v1/send-sms-campaign`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ action: "run", campaignId: id }),
    }).then((r) => r.text()).catch((e) => console.error("[sms-campaign] continuation failed", e?.message));
    // @ts-ignore EdgeRuntime is provided by the runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(next);
  } else {
    await sb.from("sms_campaigns").update({ status: "sent", sent_at: new Date().toISOString(), ...tot }).eq("id", id);
  }
  return { sent, failed, skipped, remaining };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const gate = await requireStaff(req);
  if (!gate.ok) return gate.response;
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  try {
    const b = await req.json();
    const action = String(b?.action ?? "");

    if (action === "run") {
      if (!UUID.test(b.campaignId ?? "")) return json({ ok: false, error: "campaignId required" }, 400);
      return json({ ok: true, ...(await runCampaign(sb, b.campaignId)) });
    }
    if (action === "cancel") {
      if (!UUID.test(b.campaignId ?? "")) return json({ ok: false, error: "campaignId required" }, 400);
      const { data } = await sb.from("sms_campaigns").update({ status: "cancelled" }).eq("id", b.campaignId).eq("status", "scheduled").select("id");
      await sb.rpc("unschedule_sms_campaign", { _id: b.campaignId });
      return json({ ok: !!data?.length });
    }
    if (action !== "send" && action !== "schedule") return json({ ok: false, error: "Unknown action" }, 400);

    const name = String(b.name ?? "").trim().slice(0, 120);
    const body = String(b.body ?? "").trim();
    const media: string[] = Array.isArray(b.mediaUrls) ? b.mediaUrls.filter((u: unknown) => typeof u === "string").slice(0, 10) : [];
    const ids: string[] = Array.isArray(b.userIds) ? [...new Set<string>(b.userIds.filter((x: unknown) => typeof x === "string" && UUID.test(x as string)))] : [];
    if (!name) return json({ ok: false, error: "Campaign name required" }, 400);
    if (!body && !media.length) return json({ ok: false, error: "Message required" }, 400);
    if (body.length > 1600) return json({ ok: false, error: "Message too long" }, 400);
    const contacts = (Array.isArray(b.contacts) ? b.contacts : [])
      .filter((x: any) => x && typeof x.phone === "string" && x.phone.replace(/\D/g, "").length >= 10)
      .slice(0, 5000)
      .map((x: any) => ({ phone: String(x.phone).slice(0, 30), first_name: x.first_name ? String(x.first_name).slice(0, 60) : null, last_name: x.last_name ? String(x.last_name).slice(0, 60) : null }));
    if (!ids.length && !contacts.length) return json({ ok: false, error: "No recipients" }, 400);

    let sendAt: Date | null = null;
    if (action === "schedule") {
      sendAt = new Date(b.sendAt);
      if (isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() + 60_000) return json({ ok: false, error: "Pick a time at least 2 minutes from now" }, 400);
    }
    const { data: row, error } = await sb.from("sms_campaigns").insert({
      campaign_name: name, campaign_type: "targeted", body, media_urls: media, media_count: media.length,
      recipient_user_ids: ids, recipient_contacts: contacts, filters: b.filters ?? null, segment_id: UUID.test(b.segmentId ?? "") ? b.segmentId : null,
      status: action === "schedule" ? "scheduled" : "sending", scheduled_at: sendAt?.toISOString() ?? null,
      created_by: gate.userId === "service_role" ? null : gate.userId,
    }).select("id").single();
    if (error) return json({ ok: false, error: error.message });

    if (action === "schedule") {
      const { error: armErr } = await sb.rpc("arm_sms_campaign", { _id: row.id, _send_at: sendAt!.toISOString() });
      if (armErr) {
        await sb.from("sms_campaigns").update({ status: "failed", error: armErr.message }).eq("id", row.id);
        return json({ ok: false, error: "Couldn't set the timer: " + armErr.message });
      }
      return json({ ok: true, scheduled: true, campaignId: row.id });
    }
    return json({ ok: true, campaignId: row.id, ...(await runCampaign(sb, row.id)) });
  } catch (e: any) {
    console.error("send-sms-campaign", e);
    return json({ ok: false, error: e?.message ?? "Failed" }, 500);
  }
});
