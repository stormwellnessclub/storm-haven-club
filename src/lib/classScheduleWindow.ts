import { addDays, addWeeks, isAfter, parseISO, startOfWeek } from "date-fns";

/** Keep the usual rolling window, but include the full approved November schedule. */
export function classScheduleWindowEnd(today: Date): Date {
  const rollingEnd = addDays(addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 4), -1);
  const novemberEnd = parseISO("2026-11-30");
  return isAfter(novemberEnd, rollingEnd) ? novemberEnd : rollingEnd;
}