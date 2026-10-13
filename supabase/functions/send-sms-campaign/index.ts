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
  const { data: profs } = ids.length
    ? await sb.from("profiles").select("user_id, first_name, last_name, phone, sms_opt_in").in("user_id", ids)
    : { data: [] };
  let sent = 0, failed = 0, skipped = 0;
  const seen = new Set<string>();
  const list = (profs ?? []).filter((p: any) => {
    const tail = String(p.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!p.sms_opt_in || tail.length < 10 || seen.has(tail)) { skipped++; return false; }
    seen.add(tail); return true;
  });
  for (let i = 0; i < list.length; i += 10) {
    const batch = list.slice(i, i + 10);
    await Promise.all(batch.map(async (p: any) => {
      const text = render(c.body ?? "", { first_name: p.first_name ?? "there", name: p.first_name ?? "there" });
      let status = "failed", sid: string | null = null, err: string | null = null;
      try {
        const r = await fetch(`${URL_}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({
            to: { userId: p.user_id, phone: p.phone },
            templateKey: "admin-custom",
            variables: { customBody: text },
            idempotencyKey: `campaign-${id}-${p.user_id}`,
            metadata: { source: "targeted_campaign", campaign_id: id },
            mediaUrls: c.media_urls ?? [],
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.success !== false) { status = "sent"; sid = d?.twilio_sid ?? d?.sid ?? null; sent++; }
        else { err = d?.error ?? `HTTP ${r.status}`; failed++; }
      } catch (e: any) { err = e?.message ?? "error"; failed++; }
      await sb.from("sms_campaign_recipients").insert({
        campaign_id: id, recipient_user_id: p.user_id, phone: p.phone,
        recipient_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        status, twilio_sid: sid, error_message: err, sent_at: new Date().toISOString(),
      });
    }));
  }
  await sb.from("sms_campaigns").update({
    status: "sent", sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed, skipped_count: skipped,
  }).eq("id", id);
  return { sent, failed, skipped };
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
    if (!ids.length) return json({ ok: false, error: "No recipients" }, 400);

    let sendAt: Date | null = null;
    if (action === "schedule") {
      sendAt = new Date(b.sendAt);
      if (isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() + 60_000) return json({ ok: false, error: "Pick a time at least 2 minutes from now" }, 400);
    }
    const { data: row, error } = await sb.from("sms_campaigns").insert({
      campaign_name: name, campaign_type: "targeted", body, media_urls: media, media_count: media.length,
      recipient_user_ids: ids, filters: b.filters ?? null, segment_id: UUID.test(b.segmentId ?? "") ? b.segmentId : null,
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
