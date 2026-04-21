/**
 * Canonical billing terminology used across the application.
 *
 * Use these constants and helpers everywhere instead of hard-coded strings
 * so that the language stays consistent across the member portal, admin UI,
 * receipts, emails, and Stripe descriptors.
 *
 * Definitions:
 * - Monthly Dues: recurring monthly membership charge (month-to-month members)
 * - Annual Dues: recurring yearly membership charge (founding members + anyone billed yearly)
 * - Annual Fee: separate yearly facility fee (every member, separate Stripe subscription)
 */

export const BILLING_TERMS = {
  monthlyDues: "Monthly Dues",
  annualDues: "Annual Dues",
  annualFee: "Annual Fee",
  upcomingMonthlyDues: "Upcoming Monthly Dues",
  upcomingAnnualDues: "Upcoming Annual Dues",
  upcomingAnnualFee: "Upcoming Annual Fee",
} as const;

export type BillingTypeLike = string | null | undefined;

/**
 * Returns the correct dues label for a member based on their billing cadence.
 * Founding members are always annual.
 */
export function getDuesLabel(
  billingType: BillingTypeLike,
  isFoundingMember = false,
): string {
  const isAnnual = isFoundingMember || (billingType ?? "").toLowerCase() === "annual";
  return isAnnual ? BILLING_TERMS.annualDues : BILLING_TERMS.monthlyDues;
}

/**
 * Returns the correct "next charge" label for a member based on their cadence.
 */
export function getUpcomingDuesLabel(
  billingType: BillingTypeLike,
  isFoundingMember = false,
): string {
  const isAnnual = isFoundingMember || (billingType ?? "").toLowerCase() === "annual";
  return isAnnual ? BILLING_TERMS.upcomingAnnualDues : BILLING_TERMS.upcomingMonthlyDues;
}

/**
 * Display string for the member's billing cadence.
 * Returns "Annual (Founding)", "Annual", or "Monthly".
 */
export function getBillingCadenceLabel(
  billingType: BillingTypeLike,
  isFoundingMember = false,
): string {
  if (isFoundingMember) return "Annual (Founding)";
  return (billingType ?? "").toLowerCase() === "annual" ? "Annual" : "Monthly";
}
