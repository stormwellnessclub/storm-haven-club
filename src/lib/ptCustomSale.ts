/**
 * Staff-side PT sale adjustments: admin discounts and custom monthly plans.
 * The server recalculates everything; these helpers only drive the sell dialog.
 */

export type DiscountMode = "amount" | "percent";

/** Price per package after an admin discount. Never below $0.01. */
export function discountedUnitPrice(catalogCents: number, mode: DiscountMode, value: number): number {
  if (!Number.isFinite(value) || value <= 0) return catalogCents;
  const off = mode === "percent"
    ? Math.round((catalogCents * Math.min(value, 100)) / 100)
    : Math.round(value * 100);
  return Math.max(1, catalogCents - off);
}

export interface CustomPlanSplit {
  firstCents: number;
  eachCents: number;
  finalCents: number;
  futureCount: number;
}

/**
 * Mirrors pt_build_custom_plan_schedule: first payment today (default = even share),
 * the rest split evenly over the remaining months, rounding remainder on the last one.
 */
export function splitCustomPlan(totalCents: number, months: number, firstCents?: number | null): CustomPlanSplit | null {
  if (!Number.isInteger(months) || months < 2 || months > 24 || totalCents <= 0) return null;
  const first = firstCents ?? Math.floor(totalCents / months);
  if (first < 0 || first >= totalCents) return null;
  const futureCount = months - 1;
  const each = Math.floor((totalCents - first) / futureCount);
  const final = totalCents - first - each * (futureCount - 1);
  return { firstCents: first, eachCents: each, finalCents: final, futureCount };
}
