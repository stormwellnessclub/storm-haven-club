/** Rules for the client PT request form. Returns a problem message or null. */
export interface PTRequestDraft {
  date: string; time: string; flexibility: "window" | "exact"; earliest: string; latest: string;
}

export function ptRequestProblem(d: PTRequestDraft, todayDetroit: string): string | null {
  if (!d.date) return "Choose a preferred date.";
  if (d.date < todayDetroit) return "Choose a date from today onward.";
  if (!d.time) return "Choose a preferred time.";
  if (d.flexibility === "window") {
    if (!d.earliest || !d.latest) return "Choose your availability window.";
    if (d.latest <= d.earliest) return "Your window must end after it starts.";
    if (d.time < d.earliest || d.time >= d.latest) return "Your preferred time must fall inside your window.";
  }
  return null;
}

export const PT_REQUEST_NOTE_MAX = 300;
