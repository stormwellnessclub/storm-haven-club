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
