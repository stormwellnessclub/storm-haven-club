// Daily: tell families once (text + email) when their Kids Care pass has ended or
// been used up and they haven't bought another. Passes never auto-renew; child
// profiles stay saved so they can simply buy again. The dashboard banner reads
// the passes directly, so it works even if a message can't be delivered.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import { pickKidsCareEndNotices, KIDS_CARE_NOTICE_LOOKBACK_DAYS } from "../_shared/kidsCarePassEnding.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function detroitDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric" }).format(new Date(iso));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const auth = await requireTrustedCaller(req);
  if (!auth.ok) return auth.response;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const since = new Date(now.getTime() - KIDS_CARE_NOTICE_LOOKBACK_DAYS * 86_400_000).toISOString();

  // Users with a Kids Care pass that ended recently or is used up.
  const { data: candidates, error: candErr } = await supabase
    .from("class_passes")
    .select("user_id")
    .ilike("pass_type", "kids_care%")
    .or(`and(expires_at.gte.${since},expires_at.lte.${now.toISOString()}),and(classes_remaining.lte.0,expires_at.gt.${now.toISOString()})`);
  if (candErr) return json({ success: false, error: candErr.message }, 500);
  const userIds = [...new Set((candidates ?? []).map((c) => c.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return json({ success: true, notices: 0 });

  const { data: passes, error: passErr } = await supabase
    .from("class_passes")
    .select("id, user_id, classes_remaining, expires_at, status")
    .ilike("pass_type", "kids_care%")
    .in("user_id", userIds);
  if (passErr) return json({ success: false, error: passErr.message }, 500);

  const { data: done } = await supabase
    .from("kids_care_pass_end_notices")
    .select("pass_id")
    .in("user_id", userIds);
  const notices = pickKidsCareEndNotices(passes ?? [], new Set((done ?? []).map((d) => d.pass_id)), now);

  const results: Array<Record<string, unknown>> = [];
  for (const n of notices) {
    // Claim first so overlapping runs can never message twice.
    const { data: claimed, error: claimErr } = await supabase
      .from("kids_care_pass_end_notices")
      .upsert(n.passIds.map((id) => ({ pass_id: id, user_id: n.userId, ended_reason: n.reason })), { onConflict: "pass_id", ignoreDuplicates: true })
      .select("pass_id");
    if (claimErr || !claimed || claimed.length === 0) continue;
    const claimedIds = claimed.map((c) => c.pass_id);

    // Kids Care is member-only: don't invite cancelled/expired members to rebuy.
    const { data: member } = await supabase.from("members").select("status").eq("user_id", n.userId).maybeSingle();
    if (!member || !["active", "frozen"].includes(member.status ?? "")) {
      await supabase.from("kids_care_pass_end_notices").update({ email_status: "skipped_not_member", sms_status: "skipped_not_member" }).in("pass_id", claimedIds);
      results.push({ user: n.userId, skipped: "not_member" });
      continue;
    }

    const { data: profile } = await supabase.from("profiles").select("first_name, email").eq("user_id", n.userId).maybeSingle();
    const endedDate = detroitDate(n.endedAt);
    const key = `kids-care-ended-${claimedIds.sort()[0]}`;

    let emailStatus = "no_email";
    if (profile?.email) {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { type: "kids_care_pass_ended", to: profile.email, data: { first_name: profile.first_name, reason: n.reason, ended_date: endedDate, idempotencyKey: key } },
      });
      emailStatus = error ? `failed: ${error.message}`.slice(0, 200) : "sent";
    }

    let smsStatus = "sent";
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: { userId: n.userId },
          templateKey: "kids-care-pass-ended",
          variables: { reason: n.reason === "used_up" ? "You've used all the sessions on your Kids Care pass." : `Your Kids Care pass ended on ${endedDate}.` },
          idempotencyKey: key,
          metadata: { source: "process-kids-care-pass-endings", pass_ids: claimedIds },
        },
      });
      if (error) smsStatus = `failed: ${error.message}`.slice(0, 200);
      else if (data?.success === false) smsStatus = String(data?.error ?? "not_sent").slice(0, 200);
    } catch (e) {
      smsStatus = `failed: ${String(e)}`.slice(0, 200);
    }

    await supabase.from("kids_care_pass_end_notices").update({ email_status: emailStatus, sms_status: smsStatus }).in("pass_id", claimedIds);
    results.push({ user: n.userId, reason: n.reason, email: emailStatus, sms: smsStatus });
  }

  return json({ success: true, notices: results.length, results });
});
