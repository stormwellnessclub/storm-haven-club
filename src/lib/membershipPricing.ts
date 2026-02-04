/**
 * Centralized membership pricing configuration
 * Used across reports and financial calculations
 */

export const MEMBERSHIP_PRICING = {
  silver: {
    monthly: { women: 200, men: 120 },
    annual: { women: 2400, men: 1440 },
  },
  gold: {
    monthly: { women: 250, men: 155 },
    annual: { women: 3000, men: 1860 },
  },
  platinum: {
    monthly: { women: 350, men: 175 },
    annual: { women: 4200, men: 2100 },
  },
  diamond: {
    monthly: { women: 500, men: null },
    annual: { women: 6000, men: null },
  },
} as const;

export const INITIATION_FEE = {
  women: 300,
  men: 175,
} as const;

export type MembershipTier = keyof typeof MEMBERSHIP_PRICING;
export type GenderType = 'women' | 'men';

/**
 * Extract the tier from a membership type string
 */
export function extractTier(membershipType: string | null | undefined): MembershipTier {
  const type = (membershipType || '').toLowerCase();
  if (type.includes('diamond')) return 'diamond';
  if (type.includes('platinum')) return 'platinum';
  if (type.includes('gold')) return 'gold';
  return 'silver'; // Default to silver
}

/**
 * Normalize gender string to standard format
 */
export function normalizeGender(gender: string | null | undefined): GenderType {
  const g = (gender || '').toLowerCase();
  if (g === 'male' || g === 'men' || g === 'man' || g === 'm') return 'men';
  return 'women'; // Default to women
}

/**
 * Get monthly price for a member
 */
export function getMonthlyPrice(tier: MembershipTier, gender: GenderType): number {
  const price = MEMBERSHIP_PRICING[tier].monthly[gender];
  return price ?? 0;
}

/**
 * Get annual price for a founding member
 */
export function getAnnualPrice(tier: MembershipTier, gender: GenderType): number {
  const price = MEMBERSHIP_PRICING[tier].annual[gender];
  return price ?? 0;
}

/**
 * Get initiation fee based on gender
 */
export function getInitiationFee(gender: GenderType): number {
  return INITIATION_FEE[gender];
}

/**
 * Calculate monthly revenue for a member
 */
export function calculateMemberMonthlyRevenue(
  membershipType: string | null | undefined,
  gender: string | null | undefined,
  isFounding: boolean
): number {
  const tier = extractTier(membershipType);
  const normalizedGender = normalizeGender(gender);
  
  if (isFounding) {
    // Founding members paid upfront, so monthly recurring is $0
    return 0;
  }
  
  return getMonthlyPrice(tier, normalizedGender);
}

/**
 * Calculate upfront annual revenue for a founding member
 */
export function calculateFoundingAnnualRevenue(
  membershipType: string | null | undefined,
  gender: string | null | undefined
): number {
  const tier = extractTier(membershipType);
  const normalizedGender = normalizeGender(gender);
  return getAnnualPrice(tier, normalizedGender);
}
