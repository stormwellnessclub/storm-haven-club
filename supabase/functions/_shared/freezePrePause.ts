// Decides whether an approved, paid freeze must pause dues BEFORE its start date.
// If the next renewal lands before the freeze starts and the month it would bill
// overlaps the freeze, that renewal must never be charged.

export interface PrePauseInput {
  nextRenewalUnix: number; // subscription current_period_end (seconds)
  freezeStartISO: string; // YYYY-MM-DD (Detroit)
  freezeEndISO: string; // YYYY-MM-DD (Detroit)
  nowUnix: number;
}

/** Detroit midnight of a YYYY-MM-DD date as unix seconds (EST/EDT handled). */
export function detroitMidnightUnix(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  // Try both offsets; pick the one whose Detroit date matches.
  for (const off of [4, 5]) {
    const t = Date.UTC(y, m - 1, d, off, 0, 0);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
    }).formatToParts(new Date(t));
    const get = (k: string) => parts.find((p) => p.type === k)?.value;
    if (`${get("year")}-${get("month")}-${get("day")}` === iso && Number(get("hour")) % 24 === 0) return t / 1000;
  }
  return Date.UTC(y, m - 1, d, 5) / 1000;
}

export function needsPrePause(i: PrePauseInput): boolean {
  const start = detroitMidnightUnix(i.freezeStartISO);
  const end = detroitMidnightUnix(i.freezeEndISO) + 86400;
  if (i.nextRenewalUnix <= i.nowUnix) return false; // already billed
  if (i.nextRenewalUnix >= start) return false; // renewal inside the freeze: normal activation pauses it
  const periodEnd = i.nextRenewalUnix + 28 * 86400; // shortest month the renewal would bill
  return periodEnd > start && i.nextRenewalUnix < end;
}

/** Freeze end (Detroit, 23:59:59) as unix seconds for pause_collection.resumes_at. */
export function resumesAtUnix(freezeEndISO: string): number {
  return detroitMidnightUnix(freezeEndISO) + 86399;
}
