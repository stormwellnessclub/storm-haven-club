/**
 * Club time helpers.
 *
 * The club operates in America/Detroit. All "today" / "this month" boundaries
 * used for counting check-ins, attendance, etc. MUST be calculated against
 * Chicago time so that every device — regardless of its local timezone —
 * sees the same numbers.
 */

const CLUB_TZ = "America/Detroit";

/**
 * Returns the YYYY-MM-DD date string for "today" in club time.
 * Useful for date-only columns (e.g. session_date, appointment_date).
 */
export function clubTodayDateStr(): string {
  // en-CA locale formats as YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: CLUB_TZ });
}

/**
 * Returns YYYY-MM-DD for the first day of the current month in club time.
 */
export function clubMonthStartDateStr(): string {
  const today = clubTodayDateStr(); // YYYY-MM-DD
  return today.slice(0, 7) + "-01";
}

/**
 * Build a UTC ISO string for a given Chicago date at 00:00 local.
 *
 * Strategy: figure out the UTC offset Chicago has on that date, then subtract
 * it from the naive UTC midnight of the same date to land on Chicago midnight.
 */
function chicagoMidnightUtcIso(dateStr: string): string {
  // Naive: pretend the date is UTC midnight
  const naiveUtc = new Date(`${dateStr}T00:00:00Z`);

  // Find what Chicago calls that instant; the diff = Chicago's UTC offset
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc);

  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;

  const asIfChicago = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    lookup.hour === "24" ? 0 : Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );

  // offsetMs = how far behind UTC Chicago is at that instant (positive number for CST/CDT)
  const offsetMs = naiveUtc.getTime() - asIfChicago;

  // Chicago midnight in UTC = naive UTC midnight + offset
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}

/** UTC ISO string for the start of "today" (Chicago midnight). */
export function clubTodayStart(): string {
  return chicagoMidnightUtcIso(clubTodayDateStr());
}

/** UTC ISO string for the start of "tomorrow" (Chicago midnight). */
export function clubTodayEnd(): string {
  const today = clubTodayDateStr();
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = next.toISOString().slice(0, 10);
  return chicagoMidnightUtcIso(nextStr);
}

/** UTC ISO string for the start of the current month (Chicago midnight on day 1). */
export function clubMonthStart(): string {
  return chicagoMidnightUtcIso(clubMonthStartDateStr());
}

/**
 * Returns true if a class session with the given date + end_time has already
 * ended in club (America/Detroit) time. Used so members can review classes the
 * same day they attend, right after the session finishes.
 *
 * `session_date` is YYYY-MM-DD. `end_time` is HH:MM or HH:MM:SS (Chicago wall
 * clock). If either is missing, returns false.
 */
export function hasSessionEnded(
  session_date?: string | null,
  end_time?: string | null,
): boolean {
  if (!session_date) return false;
  const today = clubTodayDateStr();
  if (session_date < today) return true;
  if (session_date > today) return false;
  if (!end_time) return false;
  // Same day: compare wall-clock time in Chicago.
  const nowHHMMSS = new Date().toLocaleTimeString("en-GB", {
    timeZone: CLUB_TZ,
    hour12: false,
  }); // HH:MM:SS
  const end = end_time.length === 5 ? `${end_time}:00` : end_time;
  return nowHHMMSS >= end;
}
