// Seasonal Edit massage gift pricing.
// Non-members pay the gift price. Members pay the gift price less their usual spa tier
// discount (same rates as every other spa service), so members always get the better deal.

/** Club member spa discount by tier. */
export function memberTierRate(membershipType: string | null | undefined): number {
  const t = (membershipType ?? "").toLowerCase();
  if (t.includes("diamond")) return 0.12;
  if (t.includes("platinum")) return 0.10;
  if (t.includes("gold")) return 0.08;
  if (t.includes("silver")) return 0.05;
  return 0;
}

/**
 * What the buyer pays for a massage gift. Pass the membership type of the buyer's own
 * (linked, not cancelled) membership, or null for non-members.
 */
export function massageGiftPriceCents(offerPriceCents: number, membershipType: string | null): number {
  if (membershipType == null) return offerPriceCents;
  return Math.round(offerPriceCents * (1 - memberTierRate(membershipType)));
}

/**
 * Which membership tier prices this gift: member pricing is only for a member's own massage.
 * Class gifts and massages bought for someone else always use the listed price (null).
 */
export function giftPricingTier(opts: { forSelf: boolean; isClassGift: boolean; buyerMembershipType: string | null }): string | null {
  if (opts.isClassGift || !opts.forSelf || opts.buyerMembershipType == null) return null;
  return opts.buyerMembershipType;
}
