// Woken by a one-time timer at a scheduled send time. Sends every due Body Roller email that an admin scheduled.
// Safe to call publicly: it only sends rows admins already scheduled, and only once their time has come.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: due } = await sb.from("body_roller_scheduled_sends").select("id, kind, extra_emails")
    .eq("status", "scheduled").lte("send_at", new Date(Date.now() + 60_000).toISOString());
  const done: string[] = [];
  for (const row of due ?? []) {
    // Claim it so a second wake-up can't send twice.
    const { data: claimed } = await sb.from("body_roller_scheduled_sends").update({ status: "sending" })
      .eq("id", row.id).eq("status", "scheduled").select("id");
    if (!claimed?.length) continue;
    await sb.rpc("unschedule_body_roller_send", { _id: row.id });
    try {
      const r = await fetch(`${url}/functions/v1/send-body-roller-presale-email`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ kind: row.kind, extraEmails: row.extra_emails ?? [] }),
      });
      const result = await r.json().catch(() => ({}));
      await sb.from("body_roller_scheduled_sends").update({ status: r.ok && result?.ok ? "sent" : "failed", sent_at: new Date().toISOString(), result, error: r.ok ? null : (result?.error ?? `HTTP ${r.status}`) }).eq("id", row.id);
    } catch (e: any) {
      await sb.from("body_roller_scheduled_sends").update({ status: "failed", error: e?.message ?? "Send failed" }).eq("id", row.id);
    }
    done.push(row.id);
  }
  return new Response(JSON.stringify({ ok: true, processed: done.length }), { headers: { "Content-Type": "application/json" } });
});
