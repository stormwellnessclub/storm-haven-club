import type { CoverageRule, ScheduleShift } from '@/hooks/useScheduleWeek';

export interface CoverageGap {
  department: string;
  date: string;
  start: string; // HH:MM
  end: string; // HH:MM
  required: number;
  scheduled: number;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Walk each active rule in 15-minute steps and report contiguous blocks where
 * fewer people are scheduled than the rule requires.
 */
export function findCoverageGaps(
  rules: CoverageRule[],
  shifts: ScheduleShift[],
  dates: string[]
): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const date of dates) {
    const dow = new Date(date + 'T12:00:00').getDay();
    const dayShifts = shifts.filter(
      (s) => s.shift_date === date && s.status === 'scheduled'
    );

    for (const rule of rules.filter((r) => r.is_active && r.day_of_week === dow)) {
      const relevant = dayShifts.filter((s) => (s.department ?? 'other') === rule.department);
      const start = toMin(rule.start_time);
      const end = toMin(rule.end_time);
      let gapStart: number | null = null;
      let gapMin = Number.POSITIVE_INFINITY;

      for (let t = start; t < end; t += 15) {
        const count = relevant.filter(
          (s) => toMin(s.start_time) <= t && toMin(s.end_time) > t
        ).length;
        if (count < rule.min_staff) {
          if (gapStart === null) gapStart = t;
          gapMin = Math.min(gapMin, count);
        } else if (gapStart !== null) {
          gaps.push({
            department: rule.department,
            date,
            start: toTime(gapStart),
            end: toTime(t),
            required: rule.min_staff,
            scheduled: gapMin === Number.POSITIVE_INFINITY ? 0 : gapMin,
          });
          gapStart = null;
          gapMin = Number.POSITIVE_INFINITY;
        }
      }
      if (gapStart !== null) {
        gaps.push({
          department: rule.department,
          date,
          start: toTime(gapStart),
          end: toTime(end),
          required: rule.min_staff,
          scheduled: gapMin === Number.POSITIVE_INFINITY ? 0 : gapMin,
        });
      }
    }
  }

  return gaps;
}

export function minutesOf(t: string) {
  return toMin(t);
}
