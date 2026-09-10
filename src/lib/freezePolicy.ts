import { addDays, differenceInCalendarDays } from "date-fns";

/** Members must request a freeze at least this many days before the start date. */
export const FREEZE_NOTICE_DAYS = 14;

/** Today's date in Detroit (club) time, normalized to midnight local. */
export function detroitToday(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Earliest start date a member may request (Detroit time). */
export function earliestFreezeStartDate(): Date {
  return addDays(detroitToday(), FREEZE_NOTICE_DAYS);
}

/** True when the given start date does not meet the notice requirement. */
export function isShortNoticeFreeze(startDate: Date): boolean {
  return differenceInCalendarDays(startDate, detroitToday()) < FREEZE_NOTICE_DAYS;
}
