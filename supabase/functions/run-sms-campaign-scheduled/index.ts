// Woken by a one-time timer. Sends targeted text campaigns staff already scheduled, once their time arrives.
// Only the timer (vault-held internal task token), another server (service-role key) or an
// admin/manager may trigger it; public keys are rejected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const gate = await requireTrustedCaller(req);
  if (!gate.ok) return gate.response;
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: due } = await sb.from("sms_campaigns").select("id")
    .eq("status", "scheduled").lte("scheduled_at", new Date(Date.now() + 60_000).toISOString());
  let n = 0;
  for (const row of due ?? []) {
    const { data: claimed } = await sb.from("sms_campaigns").update({ status: "sending" })
      .eq("id", row.id).eq("status", "scheduled").select("id");
    if (!claimed?.length) continue;
    await sb.rpc("unschedule_sms_campaign", { _id: row.id });
    try {
      const r = await fetch(`${url}/functions/v1/send-sms-campaign`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ action: "run", campaignId: row.id }),
      });
      if (!r.ok) await sb.from("sms_campaigns").update({ status: "failed", error: `HTTP ${r.status}` }).eq("id", row.id);
    } catch (e: any) {
      await sb.from("sms_campaigns").update({ status: "failed", error: e?.message ?? "Send failed" }).eq("id", row.id);
    }
    n++;
  }
  return new Response(JSON.stringify({ ok: true, processed: n }), { headers: { "Content-Type": "application/json" } });
});
