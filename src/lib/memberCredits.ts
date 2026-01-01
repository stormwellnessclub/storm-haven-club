import { addMonths, subDays, endOfDay, format } from "date-fns";

export type CreditType = "class" | "red_light" | "dry_cryo";

export interface TierCreditAllocation {
  class: number;
  red_light: number;
  dry_cryo: number;
}

export const TIER_CREDIT_ALLOCATIONS: Record<string, TierCreditAllocation> = {
  silver: { class: 0, red_light: 0, dry_cryo: 0 },
  gold: { class: 0, red_light: 4, dry_cryo: 2 },
  platinum: { class: 0, red_light: 6, dry_cryo: 4 },
  diamond: { class: 10, red_light: 10, dry_cryo: 6 },
};

export const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  class: "Class Credits",
  red_light: "Red Light Therapy",
  dry_cryo: "Dry Cryo",
};

export const CREDIT_TYPE_DESCRIPTIONS: Record<CreditType, string> = {
  class: "Use for any class at Storm Wellness",
  red_light: "Red light therapy sessions",
  dry_cryo: "Dry cryotherapy sessions",
};

export function getTierCredits(membershipType: string): TierCreditAllocation {
  const normalized = membershipType.toLowerCase().trim();
  
  if (normalized.includes("diamond")) return TIER_CREDIT_ALLOCATIONS.diamond;
  if (normalized.includes("platinum")) return TIER_CREDIT_ALLOCATIONS.platinum;
  if (normalized.includes("gold")) return TIER_CREDIT_ALLOCATIONS.gold;
  
  return TIER_CREDIT_ALLOCATIONS.silver;
}

export function getTierName(membershipType: string): string {
  const normalized = membershipType.toLowerCase().trim();
  
  if (normalized.includes("diamond")) return "diamond";
  if (normalized.includes("platinum")) return "platinum";
  if (normalized.includes("gold")) return "gold";
  
  return "silver";
}

export interface CycleDates {
  cycleStart: Date;
  cycleEnd: Date;
  expiresAt: Date;
}

/**
 * Calculate credit cycle dates based on the member's billing start date.
 * 
 * Example:
 * - Start date: Jan 15
 * - Cycle start: Jan 15
 * - Cycle end: Feb 14 (one month minus one day)
 * - Expires at: Feb 14 at 23:59:59
 */
export function calculateCycleDates(startDate: Date): CycleDates {
  const cycleStart = new Date(startDate);
  
  // Cycle ends one day before the next month's start date
  const nextCycleStart = addMonths(cycleStart, 1);
  const cycleEnd = subDays(nextCycleStart, 1);
  
  // Expires at the end of the cycle end day
  const expiresAt = endOfDay(cycleEnd);

  return {
    cycleStart,
    cycleEnd,
    expiresAt,
  };
}

/**
 * Get the credits to create for a given tier.
 * Returns an array of credit objects (only for credit types with value > 0).
 */
export function getCreditsToCreate(
  membershipType: string,
  userId: string,
  memberId: string,
  startDate: Date
): Array<{
  user_id: string;
  member_id: string;
  credit_type: CreditType;
  credits_total: number;
  credits_remaining: number;
  cycle_start: string;
  cycle_end: string;
  expires_at: string;
}> {
  const tierCredits = getTierCredits(membershipType);
  const { cycleStart, cycleEnd, expiresAt } = calculateCycleDates(startDate);

  const cycleStartStr = format(cycleStart, "yyyy-MM-dd");
  const cycleEndStr = format(cycleEnd, "yyyy-MM-dd");
  const expiresAtStr = expiresAt.toISOString();

  const creditsToCreate: Array<{
    user_id: string;
    member_id: string;
    credit_type: CreditType;
    credits_total: number;
    credits_remaining: number;
    cycle_start: string;
    cycle_end: string;
    expires_at: string;
  }> = [];

  if (tierCredits.class > 0) {
    creditsToCreate.push({
      user_id: userId,
      member_id: memberId,
      credit_type: "class",
      credits_total: tierCredits.class,
      credits_remaining: tierCredits.class,
      cycle_start: cycleStartStr,
      cycle_end: cycleEndStr,
      expires_at: expiresAtStr,
    });
  }

  if (tierCredits.red_light > 0) {
    creditsToCreate.push({
      user_id: userId,
      member_id: memberId,
      credit_type: "red_light",
      credits_total: tierCredits.red_light,
      credits_remaining: tierCredits.red_light,
      cycle_start: cycleStartStr,
      cycle_end: cycleEndStr,
      expires_at: expiresAtStr,
    });
  }

  if (tierCredits.dry_cryo > 0) {
    creditsToCreate.push({
      user_id: userId,
      member_id: memberId,
      credit_type: "dry_cryo",
      credits_total: tierCredits.dry_cryo,
      credits_remaining: tierCredits.dry_cryo,
      cycle_start: cycleStartStr,
      cycle_end: cycleEndStr,
      expires_at: expiresAtStr,
    });
  }

  return creditsToCreate;
}
