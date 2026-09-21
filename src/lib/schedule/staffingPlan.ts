// Staffing requirements model for the Storm Wellness Club schedule portal.
// Pure calculation — no database reads or writes. Edit OPERATING_HOURS to
// change the plan; every number on the report is derived from it.

export const SHIFT_MIN_HOURS = 4;
export const SHIFT_MAX_HOURS = 6;
export const DAYS_MIN_PER_PERSON = 3;
export const DAYS_MAX_PER_PERSON = 4;

export const DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface DayHours {
  /** Minutes from midnight */
  open: number;
  close: number;
}

export interface DepartmentPlan {
  key: string;
  name: string;
  /** How many people must be on at the same time */
  concurrency: number;
  /** Seven entries, Monday first */
  days: DayHours[];
}

const t = (h: number, m = 0) => h * 60 + m;

const mon_thu = (d: DayHours) => [d, d, d, d];

export const OPERATING_HOURS: DepartmentPlan[] = [
  {
    key: 'front_desk',
    name: 'Front desk',
    concurrency: 2,
    days: [
      ...mon_thu({ open: t(5, 30), close: t(24) }),
      { open: t(5, 30), close: t(20, 30) },
      { open: t(8), close: t(19, 30) },
      { open: t(8), close: t(19, 30) },
    ],
  },
  {
    key: 'cafe',
    name: 'Cafe',
    concurrency: 1,
    days: [
      ...mon_thu({ open: t(7), close: t(22) }),
      { open: t(8), close: t(19, 30) },
      { open: t(8), close: t(19) },
      { open: t(8), close: t(19) },
    ],
  },
  {
    key: 'kids_care',
    name: 'Kids care',
    concurrency: 1,
    days: [
      ...mon_thu({ open: t(9), close: t(19) }),
      { open: t(9), close: t(17) },
      { open: t(9), close: t(15) },
      { open: t(9), close: t(15) },
    ],
  },
];

export interface ShiftBlock {
  start: number;
  end: number;
  hours: number;
  people: number;
}

export interface DayBreakdown {
  day: string;
  open: number;
  close: number;
  openHours: number;
  /** openHours x concurrency */
  staffedHours: number;
  shiftCount: number;
  blocks: ShiftBlock[];
}

export interface DepartmentBreakdown {
  key: string;
  name: string;
  concurrency: number;
  days: DayBreakdown[];
  weeklyHours: number;
  weeklyShifts: number;
  avgShiftHours: number;
  minPeople: number;
  maxPeople: number;
}

/** Split a day's opening hours into equal shifts no longer than SHIFT_MAX_HOURS. */
function splitDay(day: DayHours, concurrency: number): ShiftBlock[] {
  const openMinutes = day.close - day.open;
  if (openMinutes <= 0) return [];
  const perPerson = Math.max(1, Math.ceil(openMinutes / (SHIFT_MAX_HOURS * 60)));
  const len = openMinutes / perPerson;
  const blocks: ShiftBlock[] = [];
  for (let i = 0; i < perPerson; i++) {
    const start = Math.round(day.open + i * len);
    const end = Math.round(day.open + (i + 1) * len);
    blocks.push({ start, end, hours: (end - start) / 60, people: concurrency });
  }
  return blocks;
}

export function buildStaffingPlan(plan: DepartmentPlan[] = OPERATING_HOURS): DepartmentBreakdown[] {
  return plan.map((dept) => {
    const days: DayBreakdown[] = dept.days.map((d, i) => {
      const blocks = splitDay(d, dept.concurrency);
      const openHours = (d.close - d.open) / 60;
      return {
        day: DAY_LABELS[i],
        open: d.open,
        close: d.close,
        openHours,
        staffedHours: openHours * dept.concurrency,
        shiftCount: blocks.length * dept.concurrency,
        blocks,
      };
    });
    const weeklyHours = days.reduce((s, d) => s + d.staffedHours, 0);
    const weeklyShifts = days.reduce((s, d) => s + d.shiftCount, 0);
    const avgShiftHours = weeklyShifts ? weeklyHours / weeklyShifts : 0;
    return {
      key: dept.key,
      name: dept.name,
      concurrency: dept.concurrency,
      days,
      weeklyHours,
      weeklyShifts,
      avgShiftHours,
      // Everyone works 3-4 days a week, so each person covers 3-4 shifts.
      minPeople: Math.ceil(weeklyShifts / DAYS_MAX_PER_PERSON),
      maxPeople: Math.ceil(weeklyShifts / DAYS_MIN_PER_PERSON),
    };
  });
}

export function planTotals(breakdown: DepartmentBreakdown[]) {
  return {
    weeklyHours: breakdown.reduce((s, d) => s + d.weeklyHours, 0),
    weeklyShifts: breakdown.reduce((s, d) => s + d.weeklyShifts, 0),
    minPeople: breakdown.reduce((s, d) => s + d.minPeople, 0),
    maxPeople: breakdown.reduce((s, d) => s + d.maxPeople, 0),
  };
}

/** 330 -> "5:30a", 1440 -> "12:00a" */
export function fmtClock(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 >= 12 ? 'p' : 'a';
  const h = h24 % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')}${ampm}`;
}

export function fmtHours(h: number) {
  return Number.isInteger(h) ? `${h}` : h.toFixed(2).replace(/0$/, '');
}

/** Plain-text version of the report for sharing with partners. */
export function staffingPlanText(breakdown: DepartmentBreakdown[], dateLabel: string) {
  const totals = planTotals(breakdown);
  const lines: string[] = [
    'STORM WELLNESS CLUB — STAFFING REQUIREMENTS',
    dateLabel,
    '',
    `Assumptions: shifts of ${SHIFT_MIN_HOURS}-${SHIFT_MAX_HOURS} hours, each person works ${DAYS_MIN_PER_PERSON}-${DAYS_MAX_PER_PERSON} days a week.`,
    '',
  ];
  for (const dept of breakdown) {
    lines.push(
      `${dept.name.toUpperCase()} (${dept.concurrency} on at a time) — ${fmtHours(dept.weeklyHours)} hours/week, ${dept.weeklyShifts} shifts, ${dept.minPeople}-${dept.maxPeople} people`
    );
    for (const d of dept.days) {
      lines.push(
        `  ${d.day.padEnd(10)} ${fmtClock(d.open)}–${fmtClock(d.close)}  ${fmtHours(d.staffedHours)} h  ${d.shiftCount} shifts`
      );
    }
    lines.push('');
  }
  lines.push(
    `TOTAL: ${fmtHours(totals.weeklyHours)} staffed hours per week, ${totals.weeklyShifts} shifts, ${totals.minPeople}-${totals.maxPeople} staff members.`
  );
  return lines.join('\n');
}
