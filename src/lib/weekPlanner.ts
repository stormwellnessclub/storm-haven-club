import { addDaysISO, weekDays } from "./workoutJournal";

export type PlanCategory = "training" | "class" | "recovery" | "cardio" | "rest" | "habit";

export interface Activity { key: string; label: string; category: PlanCategory; minutes?: number }

export const RECOVERY: Activity[] = [
  { key: "red_light", label: "Red Light", category: "recovery", minutes: 15 },
  { key: "cryo", label: "Cryo", category: "recovery", minutes: 5 },
  { key: "salt_room", label: "Salt Room", category: "recovery", minutes: 30 },
  { key: "sauna", label: "Sauna / Steam", category: "recovery", minutes: 20 },
  { key: "cold_plunge", label: "Cold plunge", category: "recovery", minutes: 5 },
  { key: "massage", label: "Massage", category: "recovery", minutes: 60 },
  { key: "stretch", label: "Stretch", category: "recovery", minutes: 20 },
  { key: "mobility", label: "Mobility", category: "recovery", minutes: 15 },
  { key: "foam_roll", label: "Foam rolling", category: "recovery", minutes: 10 },
  { key: "breathwork", label: "Meditation / breathwork", category: "recovery", minutes: 10 },
];
export const OTHER: Activity[] = [
  { key: "cardio", label: "Cardio / walk", category: "cardio", minutes: 30 },
  { key: "rest", label: "Rest day", category: "rest" },
  { key: "custom_training", label: "Custom training", category: "training", minutes: 45 },
];
export const HABITS = [
  { key: "water", label: "Water" },
  { key: "sleep", label: "7+ hrs sleep" },
  { key: "steps", label: "Steps" },
  { key: "protein", label: "Protein" },
] as const;

/** Reminder choices: minutes before start; -1 = morning-of at 8:00 AM. */
export const REMINDER_OPTIONS = [
  { v: 0, label: "No reminder" },
  { v: 15, label: "15 min before" },
  { v: 60, label: "1 hour before" },
  { v: -1, label: "Morning of (8 AM)" },
];

export const MAX_REMINDER_TEXTS_PER_DAY = 3;

/** Converts a Detroit wall-clock date+time into the real UTC instant (DST-aware). */
export function detroitWallToUtc(dateISO: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${dateISO}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Detroit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(guess).map((p) => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    const want = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10), h, m);
    guess.setTime(guess.getTime() + (want - shown));
  }
  return guess;
}

/** When the reminder for a plan item should go out, or null. */
export function reminderAt(dateISO: string, startTime: string | null, offset: number | null): Date | null {
  if (!offset) return null;
  if (offset === -1) return detroitWallToUtc(dateISO, "08:00");
  if (!startTime) return null;
  return new Date(detroitWallToUtc(dateISO, startTime.slice(0, 5)).getTime() - offset * 60_000);
}

export interface PlanLike { plan_date: string; category: string; status: string; activity_key?: string | null }

export function weekStats(entries: PlanLike[]) {
  const counted = entries.filter((e) => e.category !== "rest");
  const done = counted.filter((e) => e.status === "done").length;
  const by = (c: string) => entries.filter((e) => e.category === c).length;
  return {
    done, total: counted.length,
    pct: counted.length ? Math.round((done / counted.length) * 100) : 0,
    training: by("training") + by("cardio"), recovery: by("recovery"), classes: by("class"), rest: by("rest"),
  };
}

/** A week "hits the plan" when at least 3 items were planned and 70%+ were done. */
export function weekHit(entries: PlanLike[]): boolean {
  const s = weekStats(entries);
  return s.total >= 3 && s.done / s.total >= 0.7;
}

/** Consecutive hit weeks ending with the most recent completed week (current week counts once it's hit). */
export function weekStreak(entries: PlanLike[], currentWeekStart: string): number {
  let streak = weekHit(entries.filter((e) => inWeek(e.plan_date, currentWeekStart))) ? 1 : 0;
  for (let w = addDaysISO(currentWeekStart, -7); ; w = addDaysISO(w, -7)) {
    if (!weekHit(entries.filter((e) => inWeek(e.plan_date, w)))) break;
    streak++;
  }
  return streak;
}
const inWeek = (d: string, start: string) => d >= start && d <= addDaysISO(start, 6);

export interface Suggestion { id: string; day: string; text: string; options: Activity[] }

/** Rule-based nudges: recovery after a hard day, and a rest day each week. */
export function suggestions(entries: PlanLike[], weekStart: string, today: string): Suggestion[] {
  const out: Suggestion[] = [];
  const days = weekDays(weekStart);
  for (const day of days) {
    const hard = entries.filter((e) => e.plan_date === day && (e.category === "training" || e.category === "class")).length;
    const next = addDaysISO(day, 1);
    if (!hard || next < today || !days.includes(next)) continue;
    const nextHas = entries.some((e) => e.plan_date === next && (e.category === "recovery" || e.category === "rest"));
    if (!nextHas) {
      out.push({ id: `rec-${next}`, day: next, text: "Add recovery after your training day?",
        options: RECOVERY.filter((r) => ["red_light", "stretch", "sauna"].includes(r.key)) });
      break;
    }
  }
  if (!entries.some((e) => e.category === "rest") && entries.length >= 3) {
    const free = days.find((d) => d >= today && !entries.some((e) => e.plan_date === d));
    if (free) out.push({ id: `rest-${weekStart}`, day: free, text: "No rest day yet this week. Plan one?", options: [OTHER[1]] });
  }
  return out;
}

/** Starter week: offsets from Monday. */
export const STARTER_WEEKS: { key: string; label: string; days: { d: number; a: string }[] }[] = [
  { key: "balanced", label: "3 strength + 2 recovery", days: [
    { d: 0, a: "custom_training" }, { d: 1, a: "stretch" }, { d: 2, a: "custom_training" }, { d: 3, a: "sauna" },
    { d: 4, a: "custom_training" }, { d: 5, a: "cardio" }, { d: 6, a: "rest" }] },
  { key: "recovery", label: "Recovery-focused week", days: [
    { d: 0, a: "mobility" }, { d: 1, a: "red_light" }, { d: 2, a: "cardio" }, { d: 3, a: "salt_room" },
    { d: 4, a: "stretch" }, { d: 5, a: "sauna" }, { d: 6, a: "rest" }] },
];

export const ALL_ACTIVITIES = [...RECOVERY, ...OTHER];
export const activityByKey = (k?: string | null) => ALL_ACTIVITIES.find((a) => a.key === k);
