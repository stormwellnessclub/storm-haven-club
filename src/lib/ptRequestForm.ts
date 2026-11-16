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

/** open = requestable; full = taken by another client (can join waitlist); waitlisted = this client already waits for it. */
export type PTSlotStatus = "open" | "full" | "waitlisted";
export interface PTTrainerSlot { starts_at: string; ends_at?: string; trainer_id: string; trainer_name: string; status?: PTSlotStatus }

/**
 * Groups every trainer's open one-hour blocks by Detroit day, in time order, labelled
 * "4:30 – 5:30 PM" with the trainer's name. Clients see all trainers together (no trainer filter).
 */
export function groupTrainerSlotsByDay(slots: PTTrainerSlot[], durationMinutes = 60, includeFull = false) {
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
  const out: { label: string; slots: { key: string; iso: string; trainerId: string; trainer: string; time: string; status: PTSlotStatus }[] }[] = [];
  const sorted = [...slots].filter((s) => includeFull || (s.status ?? "open") === "open").sort((a, b) =>
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
      time: `${sameHalf ? a.slice(0, -3) : a} – ${b}`, status: s.status ?? "open" });
  }
  return out;
}

/** Safety limit on waiting requests per client (matches pt_request_create on the server); well above the 14 days of times shown. */
export const PT_MAX_PENDING_REQUESTS = 30;

export interface PTDayPick {
  day: string; iso: string; trainerId: string; trainer: string; time: string; note: string;
  /** Availability window (Detroit "HH:MM") and whether staff may confirm any time inside it. */
  earliest: string; latest: string; flexibility: "window" | "exact";
}
type PTPickInput = Omit<PTDayPick, "note" | "earliest" | "latest" | "flexibility">;

/**
 * Picking a time on the request form.
 * Single day: the new time replaces whatever was picked.
 * Multiple days: one time per day — a new time on the same day replaces that day's time,
 * picking the selected time again removes it. Clients may pick as many days as they like (up to the safety limit).
 * Each day keeps its own note.
 */
export function togglePTDayPick(picks: PTDayPick[], pick: PTPickInput, mode: "single" | "multi", max = PT_MAX_PENDING_REQUESTS):
  { picks: PTDayPick[]; problem: string | null } {
  const same = (p: PTDayPick) => p.iso === pick.iso && p.trainerId === pick.trainerId;
  if (mode === "single") {
    const keep = picks.find(same);
    if (keep) return { picks: [keep], problem: null };
    return { picks: [{ ...ptDefaultWindow(pick.iso), ...pick, note: picks[0]?.note ?? "" }], problem: null };
  }
  if (picks.some(same)) return { picks: picks.filter((p) => !same(p)), problem: null };
  const sameDay = picks.find((p) => p.day === pick.day);
  if (sameDay) return { picks: picks.map((p) => (p.day === pick.day ? { ...ptDefaultWindow(pick.iso), ...pick, note: p.note } : p)), problem: null };
  if (picks.length >= max) return { picks, problem: `You can request up to ${max} days at a time.` };
  const next = [...picks, { ...ptDefaultWindow(pick.iso), ...pick, note: "" }];
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

/** Detroit wall-clock "HH:MM" for an instant. */
export function detroitHHMM(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = parts.find((x) => x.type === "hour")?.value ?? "00", m = parts.find((x) => x.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** Window choices: every 30 minutes, 6:00 AM to 9:00 PM. */
export const PT_WINDOW_TIMES: string[] = Array.from({ length: (21 - 6) * 2 + 1 }, (_, i) => fromMin(6 * 60 + i * 30));

/** Default window for a picked time: from the picked start to three hours later (latest 9 PM); flexible within it. */
export function ptDefaultWindow(iso: string): Pick<PTDayPick, "earliest" | "latest" | "flexibility"> {
  const start = detroitHHMM(iso);
  return { earliest: start, latest: fromMin(Math.min(toMin(start) + 180, 21 * 60)), flexibility: "window" };
}

/** Problem with a picked time's window, or null. Only checked when the client is flexible within a window. */
export function ptWindowProblem(p: Pick<PTDayPick, "iso" | "earliest" | "latest" | "flexibility">): string | null {
  if (p.flexibility !== "window") return null;
  if (!p.earliest || !p.latest) return "Choose your availability window.";
  if (toMin(p.latest) <= toMin(p.earliest)) return "Your window must end after it starts.";
  const t = toMin(detroitHHMM(p.iso));
  if (t < toMin(p.earliest) || t >= toMin(p.latest)) return "Your picked time must fall inside your window.";
  return null;
}

/** "10:00 AM" for "10:00". */
export function ptClockLabel(t: string) {
  const n = toMin(t); const h = Math.floor(n / 60), m = n % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
