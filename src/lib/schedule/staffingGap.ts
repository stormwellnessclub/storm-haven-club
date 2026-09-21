// Staffing gap analysis: compares the staffing plan (src/lib/schedule/staffingPlan.ts)
// against the shifts actually on the schedule, then prices the gap.
// Pure calculation — no database reads or writes.

import { buildStaffingPlan, DAYS_MIN_PER_PERSON, DAYS_MAX_PER_PERSON } from './staffingPlan';
import { BENCHMARKS } from './industryBenchmarks';

export interface GapAssumptions {
  /** Hourly wage per department key */
  wages: Record<string, number>;
  /** Weeks the club has been open */
  weeksOpen: number;
  /** Hours a week the owner personally covers on the floor */
  ownerFloorHours: number;
  /** Active member count, used with published revenue-per-member */
  activeMembers: number;
  /** Annual revenue per member; defaults to the IHRSA multipurpose figure */
  revenuePerMember: number;
  /** Average hours a new hire covers per week */
  hoursPerHire: number;
}

export const DEFAULT_ASSUMPTIONS: GapAssumptions = {
  wages: {
    front_desk: BENCHMARKS.wage_front_desk.value!,
    cafe: BENCHMARKS.wage_cafe.value!,
    kids_care: BENCHMARKS.wage_kids_care.value!,
  },
  weeksOpen: 39,
  // Owner's stated load: about 13 hours a day at the club, seven days a week.
  ownerFloorHours: 91,
  activeMembers: 130,
  revenuePerMember: BENCHMARKS.revenue_per_member_multipurpose.value!,
  hoursPerHire: 17,
};

/** Share of total club revenue attributable to each department (IHRSA revenue mix). */
export const REVENUE_MIX: Record<string, number> = {
  cafe: BENCHMARKS.mix_fb.value! / 100,
  kids_care: BENCHMARKS.mix_kids.value! / 100,
};

export interface DayGap {
  /** Monday-first index */
  index: number;
  day: string;
  needed: number;
  scheduled: number;
  uncovered: number;
}

export interface DepartmentGap {
  key: string;
  name: string;
  needed: number;
  scheduled: number;
  uncovered: number;
  coveredPct: number;
  uncoveredPct: number;
  days: DayGap[];
  /** Shifts of plan length needed to close the gap */
  shiftsToFill: number;
  hiresMin: number;
  hiresMax: number;
  wage: number;
  weeklyPayrollToFullStaff: number;
  weeklyPayrollOfGap: number;
}

export interface GapReport {
  departments: DepartmentGap[];
  totals: {
    needed: number;
    scheduled: number;
    uncovered: number;
    coveredPct: number;
    uncoveredPct: number;
    shiftsToFill: number;
    hiresMin: number;
    hiresMax: number;
    weeklyPayrollToFullStaff: number;
    annualPayrollToFullStaff: number;
    weeklyPayrollOfGap: number;
  };
  cumulative: {
    uncoveredHours: number;
    payrollValue: number;
    ownerFloorHours: number;
  };
  ancillary: {
    key: string;
    name: string;
    sharePct: number;
    annualPotential: number;
    modelledForfeit: number;
  }[];
  hiring: { hiresPerMonth: number; monthsToFull: number }[];
  projection: ProjectionPoint[];
}

export interface ProjectionPoint {
  month: number;
  label: string;
  asIs: number;
  slow: number;
  toPlan: number;
}

export interface ScheduledInput {
  /** department key -> Monday-first array of 7 scheduled hour totals */
  byDepartmentDay: Record<string, number[]>;
}

const round = (n: number) => Math.round(n * 10) / 10;
const money = (n: number) => Math.round(n);

export function buildGapReport(
  scheduled: ScheduledInput,
  assumptions: GapAssumptions = DEFAULT_ASSUMPTIONS
): GapReport {
  const plan = buildStaffingPlan();

  const departments: DepartmentGap[] = plan.map((dept) => {
    const sched = scheduled.byDepartmentDay[dept.key] ?? [0, 0, 0, 0, 0, 0, 0];
    const days: DayGap[] = dept.days.map((d, i) => {
      const s = Math.min(sched[i] ?? 0, d.staffedHours);
      return {
        index: i,
        day: d.day,
        needed: round(d.staffedHours),
        scheduled: round(sched[i] ?? 0),
        uncovered: round(Math.max(0, d.staffedHours - s)),
      };
    });

    const needed = dept.weeklyHours;
    const scheduledHours = days.reduce((sum, d) => sum + d.scheduled, 0);
    const uncovered = days.reduce((sum, d) => sum + d.uncovered, 0);
    const wage = assumptions.wages[dept.key] ?? 16;
    const shiftsToFill = Math.ceil(uncovered / Math.max(1, dept.avgShiftHours));

    return {
      key: dept.key,
      name: dept.name,
      needed: round(needed),
      scheduled: round(scheduledHours),
      uncovered: round(uncovered),
      coveredPct: needed ? Math.round((Math.min(scheduledHours, needed) / needed) * 100) : 0,
      uncoveredPct: needed ? Math.round((uncovered / needed) * 100) : 0,
      days,
      shiftsToFill,
      hiresMin: Math.ceil(shiftsToFill / DAYS_MAX_PER_PERSON),
      hiresMax: Math.ceil(shiftsToFill / DAYS_MIN_PER_PERSON),
      wage,
      weeklyPayrollToFullStaff: money(needed * wage),
      weeklyPayrollOfGap: money(uncovered * wage),
    };
  });

  const sum = (f: (d: DepartmentGap) => number) => departments.reduce((s, d) => s + f(d), 0);
  const needed = sum((d) => d.needed);
  const scheduledHours = sum((d) => d.scheduled);
  const uncovered = sum((d) => d.uncovered);
  const weeklyPayrollOfGap = sum((d) => d.weeklyPayrollOfGap);
  const weeklyPayrollToFullStaff = sum((d) => d.weeklyPayrollToFullStaff);

  const totals = {
    needed: round(needed),
    scheduled: round(scheduledHours),
    uncovered: round(uncovered),
    coveredPct: needed ? Math.round((Math.min(scheduledHours, needed) / needed) * 100) : 0,
    uncoveredPct: needed ? Math.round((uncovered / needed) * 100) : 0,
    shiftsToFill: sum((d) => d.shiftsToFill),
    hiresMin: sum((d) => d.hiresMin),
    hiresMax: sum((d) => d.hiresMax),
    weeklyPayrollToFullStaff,
    annualPayrollToFullStaff: money(weeklyPayrollToFullStaff * 52),
    weeklyPayrollOfGap,
  };

  const cumulative = {
    uncoveredHours: round(uncovered * assumptions.weeksOpen),
    payrollValue: money(weeklyPayrollOfGap * assumptions.weeksOpen),
    ownerFloorHours: round(assumptions.ownerFloorHours * assumptions.weeksOpen),
  };

  const annualRevenue = assumptions.activeMembers * assumptions.revenuePerMember;
  const ancillary = departments
    .filter((d) => REVENUE_MIX[d.key] != null)
    .map((d) => {
      const annualPotential = annualRevenue * REVENUE_MIX[d.key];
      return {
        key: d.key,
        name: d.name,
        sharePct: REVENUE_MIX[d.key] * 100,
        annualPotential: money(annualPotential),
        modelledForfeit: money(annualPotential * (d.uncoveredPct / 100)),
      };
    });

  const hiring = [2, 4, 6].map((hiresPerMonth) => ({
    hiresPerMonth,
    monthsToFull: Math.ceil(
      uncovered / Math.max(1, assumptions.hoursPerHire) / Math.max(1, hiresPerMonth)
    ),
  }));

  // Twelve-month cumulative cost of the gap under three hiring paces.
  const weeksPerMonth = 52 / 12;
  const hourlyBlend = uncovered ? weeklyPayrollOfGap / uncovered : 16;
  const scenario = (hiresPerMonth: number) => {
    const points: number[] = [];
    let remaining = uncovered;
    let running = 0;
    for (let m = 1; m <= 12; m++) {
      running += remaining * weeksPerMonth * hourlyBlend;
      points.push(money(running));
      remaining = Math.max(0, remaining - hiresPerMonth * assumptions.hoursPerHire);
    }
    return points;
  };
  const asIs = scenario(0);
  const slow = scenario(2);
  const toPlan = scenario(5);
  const projection: ProjectionPoint[] = asIs.map((_, i) => ({
    month: i + 1,
    label: `M${i + 1}`,
    asIs: asIs[i],
    slow: slow[i],
    toPlan: toPlan[i],
  }));

  return { departments, totals, cumulative, ancillary, hiring, projection };
}

export function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function fmtHrs(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
}
