import { addDays, addMonths, differenceInCalendarDays, intervalToDuration, parseISO, format } from "date-fns";

export interface CommitmentFreeze {
  status: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  requested_start_date: string;
  requested_end_date: string;
}

export function membershipCommitment(startISO: string, freezes: CommitmentFreeze[], todayISO: string) {
  const start = parseISO(startISO);
  const today = parseISO(todayISO);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(today.getTime())) return null;
  const intervals = freezes.filter(f => ["active", "completed"].includes(f.status)).flatMap(f => {
    const from = parseISO(f.actual_start_date ?? f.requested_start_date);
    // Active time is provisional; completed freezes use the actual resumption date.
    const to = f.status === "active" ? today : parseISO(f.actual_end_date ?? f.requested_end_date);
    const a = Math.max(start.getTime(), from.getTime());
    const b = Math.min(today.getTime(), to.getTime());
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? [[a, b]] : [];
  }).sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const range of intervals) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const frozenDays = merged.reduce((sum, [a, b]) => sum + differenceInCalendarDays(new Date(b), new Date(a)), 0);
  const originalEnd = addMonths(start, 12);
  const adjustedEnd = addDays(originalEnd, frozenDays);
  const daysRemaining = Math.max(0, differenceInCalendarDays(adjustedEnd, today));
  const duration = daysRemaining ? intervalToDuration({ start: today, end: adjustedEnd }) : {};
  const monthsRemaining = (duration.years ?? 0) * 12 + (duration.months ?? 0);
  return {
    originalEndISO: format(originalEnd, "yyyy-MM-dd"),
    adjustedEndISO: format(adjustedEnd, "yyyy-MM-dd"), frozenDays, daysRemaining,
    monthsRemaining, extraDays: duration.days ?? 0,
    provisional: freezes.some(f => f.status === "active"),
  };
}