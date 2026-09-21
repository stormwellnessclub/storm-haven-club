// The cost of a stretched launch — partner brief calculations.
// Built on top of the staffing gap report. Pure calculation: no database reads or writes.
// Every figure here is either measured from the club's own schedule and the owner's stated
// hours, or explicitly labelled as modelled from a cited industry benchmark.

import { buildGapReport, REVENUE_MIX, type GapAssumptions, type GapReport, type ScheduledInput } from './staffingGap';
import { BENCHMARKS } from './industryBenchmarks';

export interface OwnerLoad {
  /** Hours a day physically at the club */
  clubHoursPerDay: number;
  /** Days a week at the club */
  daysPerWeek: number;
  /** Admin / business-side hours a day, after the club hours */
  adminHoursPerDay: number;
}

export const DEFAULT_OWNER_LOAD: OwnerLoad = {
  clubHoursPerDay: 13,
  daysPerWeek: 7,
  adminHoursPerDay: 3,
};

/** A normal full-time week, used as the comparison baseline. */
export const FULL_TIME_WEEK = 40;

export interface LaunchCostReport {
  gap: GapReport;
  owner: {
    clubHoursPerWeek: number;
    adminHoursPerWeek: number;
    totalHoursPerWeek: number;
    /** Hours a week beyond a normal full-time job */
    overagePerWeek: number;
    /** Multiple of a full-time week */
    fullTimeJobs: number;
    totalHoursToDate: number;
    clubHoursToDate: number;
    overageToDate: number;
    /** Replacement wage used to value the owner's floor hours */
    replacementWage: number;
    /** What the owner's club hours would have cost as paid staff */
    clubHoursValueToDate: number;
    overageValueToDate: number;
  };
  toDate: {
    weeksOpen: number;
    monthsOpen: number;
    /** Uncovered hours since opening and their labour value */
    uncoveredHours: number;
    unfilledWorkValue: number;
    /** Modelled forfeited cafe + kids care revenue over the period open */
    forfeitedDepartmentRevenue: number;
    /** Payroll never spent because the roles were never filled */
    payrollNotSpent: number;
    /** Unfilled work + forfeited revenue + the owner's unpaid overage */
    totalExposure: number;
  };
  perMonth: {
    unfilledWork: number;
    forfeitedRevenue: number;
    ownerOverage: number;
    total: number;
  };
  rollforward: { months: number; label: string; cost: number }[];
  catchUp: {
    hiresPerMonth: number;
    monthsToFull: number;
    /** Total cost of the delay accumulated while hiring at this pace */
    costWhileHiring: number;
  }[];
  behind: {
    monthsOpen: number;
    monthsFullyOperating: number;
    monthsBehind: number;
    /** Benchmark membership lifetime, for context on how much of it has elapsed */
    membershipLengthMonths: number;
    /** Share of the benchmark membership lifetime spent at partial staffing */
    lifetimeSharePct: number;
    /** Annual revenue the current member base represents on the published benchmark */
    memberBaseAnnualRevenue: number;
  };
  options: {
    key: 'asIs' | 'slow' | 'toPlan';
    name: string;
    hiresPerMonth: number;
    /** Twelve-month cost of work left unfilled under this pace */
    unfilledWorkYear: number;
    /** Twelve-month payroll invested in the hires made */
    payrollInvested: number;
    /** Owner hours still carried over the twelve months */
    ownerHoursCarried: number;
    /** Unfilled work + forfeited revenue under this pace */
    totalExposure: number;
  }[];
}

const money = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildLaunchCostReport(
  scheduled: ScheduledInput,
  assumptions: GapAssumptions,
  ownerLoad: OwnerLoad
): LaunchCostReport {
  const gap = buildGapReport(scheduled, assumptions);

  const weeksOpen = Math.max(1, assumptions.weeksOpen);
  const monthsOpen = round1(weeksOpen / (52 / 12));
  const weeksPerMonth = 52 / 12;

  // Blended hourly rate across the uncovered hours — what it would cost to buy that work.
  const replacementWage =
    gap.totals.uncovered > 0
      ? gap.totals.weeklyPayrollOfGap / gap.totals.uncovered
      : (assumptions.wages.front_desk ?? 16);

  const clubHoursPerWeek = ownerLoad.clubHoursPerDay * ownerLoad.daysPerWeek;
  const adminHoursPerWeek = ownerLoad.adminHoursPerDay * ownerLoad.daysPerWeek;
  const totalHoursPerWeek = clubHoursPerWeek + adminHoursPerWeek;
  const overagePerWeek = Math.max(0, totalHoursPerWeek - FULL_TIME_WEEK);

  const owner = {
    clubHoursPerWeek: round1(clubHoursPerWeek),
    adminHoursPerWeek: round1(adminHoursPerWeek),
    totalHoursPerWeek: round1(totalHoursPerWeek),
    overagePerWeek: round1(overagePerWeek),
    fullTimeJobs: round1(totalHoursPerWeek / FULL_TIME_WEEK),
    totalHoursToDate: Math.round(totalHoursPerWeek * weeksOpen),
    clubHoursToDate: Math.round(clubHoursPerWeek * weeksOpen),
    overageToDate: Math.round(overagePerWeek * weeksOpen),
    replacementWage: Math.round(replacementWage * 100) / 100,
    clubHoursValueToDate: money(clubHoursPerWeek * weeksOpen * replacementWage),
    overageValueToDate: money(overagePerWeek * weeksOpen * replacementWage),
  };

  // Modelled department revenue forfeited, converted from the annual figure to the period open.
  const forfeitAnnual = gap.ancillary.reduce((s, a) => s + a.modelledForfeit, 0);
  const forfeitedDepartmentRevenue = money((forfeitAnnual / 52) * weeksOpen);

  const unfilledWorkValue = gap.cumulative.payrollValue;
  const payrollNotSpent = unfilledWorkValue;

  const toDate = {
    weeksOpen,
    monthsOpen,
    uncoveredHours: Math.round(gap.cumulative.uncoveredHours),
    unfilledWorkValue,
    forfeitedDepartmentRevenue,
    payrollNotSpent,
    totalExposure: money(
      unfilledWorkValue + forfeitedDepartmentRevenue + owner.overageValueToDate
    ),
  };

  const perMonthUnfilled = money(gap.totals.weeklyPayrollOfGap * weeksPerMonth);
  const perMonthForfeit = money(forfeitAnnual / 12);
  const perMonthOwner = money(overagePerWeek * weeksPerMonth * replacementWage);
  const perMonth = {
    unfilledWork: perMonthUnfilled,
    forfeitedRevenue: perMonthForfeit,
    ownerOverage: perMonthOwner,
    total: perMonthUnfilled + perMonthForfeit + perMonthOwner,
  };

  const rollforward = [1, 3, 6, 12].map((months) => ({
    months,
    label: months === 1 ? 'One more month' : `${months} more months`,
    cost: money(perMonth.total * months),
  }));

  // Cost still accumulated while hiring at each pace: the gap shrinks month by month.
  const catchUp = [2, 4, 6].map((hiresPerMonth) => {
    let remaining = gap.totals.uncovered;
    let cost = 0;
    let months = 0;
    while (remaining > 0 && months < 60) {
      months += 1;
      cost += remaining * weeksPerMonth * replacementWage;
      // The owner's overage only eases as coverage arrives.
      const coveredShare = gap.totals.uncovered ? 1 - remaining / gap.totals.uncovered : 1;
      cost += overagePerWeek * (1 - coveredShare) * weeksPerMonth * replacementWage;
      remaining = Math.max(0, remaining - hiresPerMonth * assumptions.hoursPerHire);
    }
    return { hiresPerMonth, monthsToFull: months, costWhileHiring: money(cost) };
  });

  const membershipLength = BENCHMARKS.membership_length.value ?? 20.2;
  const behind = {
    monthsOpen,
    monthsFullyOperating: 0,
    monthsBehind: monthsOpen,
    membershipLengthMonths: membershipLength,
    lifetimeSharePct: Math.round((monthsOpen / membershipLength) * 100),
    memberBaseAnnualRevenue: money(assumptions.activeMembers * assumptions.revenuePerMember),
  };

  const optionSpec: { key: 'asIs' | 'slow' | 'toPlan'; name: string; hiresPerMonth: number }[] = [
    { key: 'asIs', name: 'Stay as we are', hiresPerMonth: 0 },
    { key: 'slow', name: 'Hire slowly', hiresPerMonth: 2 },
    { key: 'toPlan', name: 'Hire to plan', hiresPerMonth: 5 },
  ];

  const options = optionSpec.map((spec) => {
    let remaining = gap.totals.uncovered;
    let unfilled = 0;
    let payroll = 0;
    let ownerHours = 0;
    for (let m = 1; m <= 12; m++) {
      unfilled += remaining * weeksPerMonth * replacementWage;
      const filled = gap.totals.uncovered - remaining;
      payroll += filled * weeksPerMonth * replacementWage;
      const coveredShare = gap.totals.uncovered ? filled / gap.totals.uncovered : 1;
      ownerHours += overagePerWeek * (1 - coveredShare) * weeksPerMonth;
      remaining = Math.max(0, remaining - spec.hiresPerMonth * assumptions.hoursPerHire);
    }
    const forfeitShare = gap.totals.uncovered
      ? unfilled / (gap.totals.uncovered * 12 * weeksPerMonth * replacementWage || 1)
      : 0;
    return {
      ...spec,
      unfilledWorkYear: money(unfilled),
      payrollInvested: money(payroll),
      ownerHoursCarried: Math.round(ownerHours),
      totalExposure: money(unfilled + forfeitAnnual * forfeitShare),
    };
  });

  return { gap, owner, toDate, perMonth, rollforward, catchUp, behind, options };
}

export { REVENUE_MIX };
