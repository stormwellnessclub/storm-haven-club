/** Rules for the client PT request form. Returns a problem message or null. */
export interface PTRequestDraft {
  date: string; time: string; flexibility: "window" | "exact"; earliest: string; latest: string;
}

export function detroitToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(now);
}

/** "Request another time" fallback; requests start from tomorrow (Detroit), matching the server. */
export function ptRequestProblem(d: PTRequestDraft, todayDetroit: string): string | null {
  if (!d.date) return "Choose a preferred date.";
  if (d.date <= todayDetroit) return "Choose a date from tomorrow onward.";
  if (!d.time) return "Choose a preferred time.";
  if (d.flexibility === "window") {
    if (!d.earliest || !d.latest) return "Choose your availability window.";
    if (d.latest <= d.earliest) return "Your window must end after it starts.";
    if (d.time < d.earliest || d.time >= d.latest) return "Your preferred time must fall inside your window.";
  }
  return null;
}

/** Groups server-provided open start times by Detroit day, in order, for display. */
export function groupSlotsByDay(isos: string[]) {
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
  const out: { label: string; slots: { iso: string; time: string }[] }[] = [];
  for (const iso of [...isos].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())) {
    const d = new Date(iso);
    const label = dayFmt.format(d);
    let g = out[out.length - 1];
    if (!g || g.label !== label) { g = { label, slots: [] }; out.push(g); }
    g.slots.push({ iso, time: timeFmt.format(d) });
  }
  return out;
}

export const PT_REQUEST_NOTE_MAX = 300;

export interface PTTrainerSlot { starts_at: string; ends_at?: string; trainer_id: string; trainer_name: string }

/**
 * Groups every trainer's open one-hour blocks by Detroit day, in time order, labelled
 * "4:30 – 5:30 PM" with the trainer's name. Clients see all trainers together (no trainer filter).
 */
export function groupTrainerSlotsByDay(slots: PTTrainerSlot[], durationMinutes = 60) {
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
  const out: { label: string; slots: { key: string; iso: string; trainerId: string; trainer: string; time: string }[] }[] = [];
  const sorted = [...slots].sort((a, b) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() || a.trainer_name.localeCompare(b.trainer_name));
  for (const s of sorted) {
    const start = new Date(s.starts_at);
    const end = s.ends_at ? new Date(s.ends_at) : new Date(start.getTime() + durationMinutes * 60000);
    const label = dayFmt.format(start);
    let g = out[out.length - 1];
    if (!g || g.label !== label) { g = { label, slots: [] }; out.push(g); }
    const a = timeFmt.format(start), b = timeFmt.format(end);
    const sameHalf = a.slice(-2) === b.slice(-2);
    g.slots.push({ key: `${s.starts_at}|${s.trainer_id}`, iso: s.starts_at, trainerId: s.trainer_id, trainer: s.trainer_name,
      time: `${sameHalf ? a.slice(0, -3) : a} – ${b}` });
  }
  return out;
}

/** Most pending requests a client may have at once (matches pt_request_create on the server). */
export const PT_MAX_PENDING_REQUESTS = 5;

export interface PTDayPick { day: string; iso: string; trainerId: string; trainer: string; time: string; note: string }

/**
 * Picking a time on the request form.
 * Single day: the new time replaces whatever was picked.
 * Multiple days: one time per day — a new time on the same day replaces that day's time,
 * picking the selected time again removes it, and no more than `max` days can be picked.
 * Each day keeps its own note.
 */
export function togglePTDayPick(picks: PTDayPick[], pick: Omit<PTDayPick, "note">, mode: "single" | "multi", max = PT_MAX_PENDING_REQUESTS):
  { picks: PTDayPick[]; problem: string | null } {
  const same = (p: PTDayPick) => p.iso === pick.iso && p.trainerId === pick.trainerId;
  if (mode === "single") {
    const keep = picks.find(same);
    return { picks: [{ ...pick, note: keep?.note ?? picks[0]?.note ?? "" }], problem: null };
  }
  if (picks.some(same)) return { picks: picks.filter((p) => !same(p)), problem: null };
  const sameDay = picks.find((p) => p.day === pick.day);
  if (sameDay) return { picks: picks.map((p) => (p.day === pick.day ? { ...pick, note: p.note } : p)), problem: null };
  if (picks.length >= max) return { picks, problem: `You can request up to ${max} days at a time.` };
  const next = [...picks, { ...pick, note: "" }];
  next.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
  return { picks: next, problem: null };
}

/** Trainer colour shades (browns and beiges): Storm darkest, Felicia middle, Klaudia lightest; others plain. */
export type PTTrainerShade = "deep" | "tan" | "sand" | null;
export function ptTrainerShade(trainerName: string): PTTrainerShade {
  const first = trainerName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (first === "storm") return "deep";
  if (first === "felicia") return "tan";
  if (first === "klaudia") return "sand";
  return null;
}
