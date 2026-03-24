import { parse, addMinutes, isBefore, format } from "date-fns";

/**
 * Returns true if a class session has already finished (end time is in the past).
 * Used to hide completed classes from public-facing schedule views.
 */
export function isSessionFinishedToday(
  sessionDate: string,
  startTime: string,
  durationMinutes: number,
  now: Date = new Date()
): boolean {
  const todayStr = format(now, "yyyy-MM-dd");
  if (sessionDate !== todayStr) return false;

  const slotStart = parse(
    `${sessionDate} ${startTime}`,
    "yyyy-MM-dd HH:mm:ss",
    new Date()
  );
  const slotEnd = addMinutes(slotStart, durationMinutes);
  return isBefore(slotEnd, now);
}
