// Sends Plan My Week reminder texts. Woken only by the self-removing
// 'planner-reminder-next' timer (arm_planner_reminder_timer), never polled.
// Every text goes through send-sms (consent checked; account opt-out wins).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isValidInternalToken, presentedInternalToken } from "../_shared/internalTaskToken.ts";

const MAX_PER_DAY = 3;
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const detroitDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
function wallToUtc(dateISO: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const g = new Date(`${dateISO}T${hhmm.slice(0, 5)}:00Z`);
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(g).map((x) => [x.type, x.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    const want = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10), h, m);
    g.setTime(g.getTime() + (want - shown));
  }
  return g;
}

Deno.serve(async (req) => {
  if (!(await isValidInternalToken(presentedInternalToken(req)))) return new Response("forbidden", { status: 403 });
  const db = createClient(URL_, KEY);
  const now = new Date();
  const today = detroitDate(now);
  const dayStartUtc = wallToUtc(today, "00:00").toISOString();
  let sent = 0, skipped = 0;

  const names = new Map<string, string>();
  const firstName = async (uid: string) => {
    if (!names.has(uid)) {
      const { data } = await db.from("profiles").select("first_name").eq("id", uid).maybeSingle();
      names.set(uid, (data?.first_name || "").trim() || "there");
    }
    return names.get(uid)!;
  };
  const sendCapped = async (uid: string, dedupe: string, templateKey: string, variables: Record<string, string>) => {
    const { count } = await db.from("workout_reminder_sends").select("id", { count: "exact", head: true })
      .eq("user_id", uid).gte("sent_at", dayStartUtc);
    if ((count ?? 0) >= MAX_PER_DAY) { skipped++; return; }
    const { error: dupe } = await db.from("workout_reminder_sends").insert({ user_id: uid, dedupe_key: dedupe });
    if (dupe) { skipped++; return; }
    await fetch(`${URL_}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ to: { userId: uid }, templateKey, variables }),
    }).catch(() => null);
    sent++;
  };

  // Item reminders
  const { data: due } = await db.from("workout_plan_entries")
    .select("id,user_id,plan_date,label,start_time,status,template_id,workout_templates(template_name)")
    .is("reminder_sent_at", null).not("reminder_at", "is", null).lte("reminder_at", now.toISOString())
    .gte("reminder_at", new Date(now.getTime() - 2 * 3600_000).toISOString()).eq("status", "planned").limit(200);
  for (const e of due || []) {
    await db.from("workout_plan_entries").update({ reminder_sent_at: now.toISOString() }).eq("id", e.id);
    const item = (e as any).workout_templates?.template_name || e.label || "your workout";
    await sendCapped(e.user_id, `entry:${e.id}`, "planner-reminder", {
      name: await firstName(e.user_id), item, when: e.start_time ? ` at ${fmtTime(e.start_time)}` : " today",
    });
  }

  // Morning summaries
  const { data: prefs } = await db.from("workout_reminder_prefs").select("user_id,summary_time")
    .eq("daily_summary", true).lte("next_summary_at", now.toISOString()).limit(200);
  for (const p of prefs || []) {
    const tomorrow = detroitDate(new Date(now.getTime() + 24 * 3600_000));
    await db.from("workout_reminder_prefs").update({ next_summary_at: wallToUtc(tomorrow, p.summary_time.slice(0, 5)).toISOString() }).eq("user_id", p.user_id);
    const { data: items } = await db.from("workout_plan_entries").select("label,start_time,workout_templates(template_name)")
      .eq("user_id", p.user_id).eq("plan_date", today).eq("status", "planned").neq("category", "habit").order("start_time");
    if (!items?.length) continue;
    const list = items.slice(0, 4).map((i: any) => `${i.workout_templates?.template_name || i.label}${i.start_time ? ` ${fmtTime(i.start_time)}` : ""}`).join(", ");
    await sendCapped(p.user_id, `summary:${p.user_id}:${today}`, "planner-daily-summary", { name: await firstName(p.user_id), items: list });
  }

  await db.rpc("arm_planner_reminder_timer");
  return new Response(JSON.stringify({ sent, skipped }), { headers: { "Content-Type": "application/json" } });
});
