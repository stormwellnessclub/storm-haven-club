/**
 * Guest pass check-in helpers.
 *
 * Historically two different strings were written when a guest was checked in:
 * the kiosk RPC writes `used`, the front desk / admin UIs write `exhausted`.
 * Treat both as "checked in" when reading, and always stamp the same fields
 * when writing so a check-in can never end up without a date.
 */
import { clubTodayDateStr } from "@/lib/clubTime";

export const CHECKED_IN_STATUSES = ["used", "exhausted"] as const;

export function isGuestPassCheckedIn(pass: {
  status?: string | null;
  used_at?: string | null;
}): boolean {
  if (pass.used_at) return true;
  return CHECKED_IN_STATUSES.includes((pass.status || "") as any);
}

/**
 * Canonical field set written on every guest pass check-in.
 */
export function guestCheckInPatch(checkedInBy?: string | null) {
  return {
    status: "used",
    used_at: new Date().toISOString(),
    valid_date: clubTodayDateStr(),
    checked_in_by: checkedInBy ?? null,
  };
}

/**
 * Never render an empty date cell. Falls back valid_date -> purchase date.
 */
export function guestVisitDateLabel(pass: {
  used_at?: string | null;
  valid_date?: string | null;
  purchased_at?: string | null;
}): string {
  if (pass.used_at) {
    return new Date(pass.used_at).toLocaleString("en-US", {
      timeZone: "America/Detroit",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (pass.valid_date) {
    return new Date(`${pass.valid_date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (pass.purchased_at) {
    return `${new Date(pass.purchased_at).toLocaleDateString("en-US", {
      timeZone: "America/Detroit",
      month: "short",
      day: "numeric",
      year: "numeric",
    })} (purchase date)`;
  }
  return "Date not recorded";
}
