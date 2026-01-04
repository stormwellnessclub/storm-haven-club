// Stripe Product and Price IDs for Storm Wellness Club
// These IDs reference products created in Stripe

export const STRIPE_PRODUCTS = {
  memberships: {
    silver: {
      monthly: {
        women: 'price_1Sl9llLyZrsSqLhsJhm0MdJi', // $200/mo
        men: 'price_1Sl9mBLyZrsSqLhsas4CTChz',   // $120/mo
      },
      annual: {
        women: 'price_1Sl9x2LyZrsSqLhsYLtI7doB', // $2,400/yr
        men: 'price_1Sl9yLLyZrsSqLhsG6NiPqH5',   // $1,440/yr
      },
    },
    gold: {
      monthly: {
        women: 'price_1Sl9pvLyZrsSqLhsIWyf2WwX', // $250/mo
        men: 'price_1Sl9quLyZrsSqLhs6PPn9AeL',   // $155/mo
      },
      annual: {
        women: 'price_1SlA0bLyZrsSqLhsOIdyhLo7', // $3,000/yr
        men: 'price_1SlA11LyZrsSqLhsfSqUElkE',   // $1,860/yr
      },
    },
    platinum: {
      monthly: {
        women: 'price_1Sl9r7LyZrsSqLhs5RBuy2f7', // $350/mo
        men: 'price_1Sl9roLyZrsSqLhsQCydIccE',   // $175/mo
      },
      annual: {
        women: 'price_1SlA1cLyZrsSqLhsAXXQEqVx', // $4,200/yr
        men: 'price_1SlA1oLyZrsSqLhstHpodZzv',   // $2,100/yr
      },
    },
    diamond: {
      monthly: {
        women: 'price_1Sl9wILyZrsSqLhsLjYqkoqq', // $500/mo
        men: null, // Diamond not available for men
      },
      annual: {
        women: 'price_1SlA1zLyZrsSqLhsbJMZ0za2', // $6,000/yr
        men: null,
      },
    },
  },
  annualFee: {
    women: 'price_1SlA2BLyZrsSqLhs8VX17F0C', // $300/yr
    men: 'price_1SlA2RLyZrsSqLhsK3XQuANN',   // $175/yr
  },
  classPasses: {
    pilatesCycling: {
      single: {
        member: 'price_1SlA2vLyZrsSqLhsBHHWlQPD',    // $25
        nonMember: 'price_1SlA38LyZrsSqLhsMjRhYzpT', // $40
      },
      tenPack: {
        member: 'price_1SlA9sLyZrsSqLhsM0X8VDhN',    // $170
        nonMember: 'price_1SlAAJLyZrsSqLhstWGd3c8G', // $300
      },
    },
    otherClasses: {
      single: {
        member: 'price_1SlAAvLyZrsSqLhsVfY0qJgr',    // $15
        nonMember: 'price_1SlABFLyZrsSqLhsGOpvWGFE', // $30
      },
      tenPack: {
        member: 'price_1SlABPLyZrsSqLhsbL0mwcit',    // $150
        nonMember: 'price_1SlABzLyZrsSqLhseSyKYaDD', // $200
      },
    },
  },
} as const;

// Pricing data (in dollars)
const MEMBERSHIP_PRICES = {
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

const ANNUAL_FEE_AMOUNTS = {
  women: 300,
  men: 175,
} as const;

// Type helpers
export type MembershipTier = 'silver' | 'gold' | 'platinum' | 'diamond';
export type BillingType = 'monthly' | 'annual';
export type Gender = 'women' | 'men';
export type ClassPassCategory = 'pilatesCycling' | 'otherClasses';
export type ClassPassType = 'single' | 'tenPack';
export type MemberStatus = 'member' | 'nonMember';

// Helper function to get membership price amount
export function getMembershipPrice(
  tier: MembershipTier,
  billingType: BillingType,
  gender: Gender
): { amount: number; interval: string } | null {
  const price = MEMBERSHIP_PRICES[tier]?.[billingType]?.[gender];
  if (price === null || price === undefined) return null;
  return {
    amount: price,
    interval: billingType === 'annual' ? 'year' : 'month',
  };
}

// Helper function to get annual fee amount
export function getAnnualFeeAmount(gender: Gender): number {
  return ANNUAL_FEE_AMOUNTS[gender];
}

// Helper function to get membership price ID
export function getMembershipPriceId(
  tier: MembershipTier,
  billingType: BillingType,
  gender: Gender
): string | null {
  return STRIPE_PRODUCTS.memberships[tier][billingType][gender];
}

// Helper function to get annual fee price ID
export function getAnnualFeePriceId(gender: Gender): string {
  return STRIPE_PRODUCTS.annualFee[gender];
}

// Helper function to get class pass price ID
export function getClassPassPriceId(
  category: ClassPassCategory,
  passType: ClassPassType,
  memberStatus: MemberStatus
): string {
  return STRIPE_PRODUCTS.classPasses[category][passType][memberStatus];
}

// Normalize tier name from database to our type
export function normalizeTierName(dbTier: string): MembershipTier {
  const tierMap: Record<string, MembershipTier> = {
    'silver': 'silver',
    'silver membership': 'silver',
    'gold': 'gold',
    'gold membership': 'gold',
    'platinum': 'platinum',
    'platinum membership': 'platinum',
    'diamond': 'diamond',
    'diamond membership': 'diamond',
  };
  return tierMap[dbTier.toLowerCase()] || 'silver';
}

// Normalize gender from database
export function normalizeGender(dbGender: string | null): Gender {
  if (!dbGender) return 'women'; // Default to women's pricing
  const lower = dbGender.toLowerCase();
  if (lower === 'male' || lower === 'men' || lower === 'm') return 'men';
  return 'women';
}
