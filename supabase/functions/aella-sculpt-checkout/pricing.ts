// Card charges add the club's processing fee: (amount + $0.30) / (1 - 0.029).
export function processingFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.ceil((amountCents + 30) / 0.971) - amountCents;
}

/** Club member discount by tier, same as every other spa service. */
export function memberTierRate(membershipType: string | null | undefined): number {
  const t = (membershipType ?? "").toLowerCase();
  if (t.includes("diamond")) return 0.12;
  if (t.includes("platinum")) return 0.10;
  if (t.includes("gold")) return 0.08;
  if (t.includes("silver")) return 0.05;
  return 0;
}

/**
 * What a client pays for a package. Non-members pay the public price. Members pay the
 * staff-set member price when there is one, otherwise the public price less their tier discount.
 * Pass the membership type for members, or null for non-members.
 */
export function packagePriceCents(pkg: { price_cents: number; member_price_cents: number | null }, membershipType: string | null): number {
  if (membershipType == null) return pkg.price_cents;
  if (pkg.member_price_cents != null) return pkg.member_price_cents;
  return Math.round(pkg.price_cents * (1 - memberTierRate(membershipType)));
}

/** What the Stripe charge says, so staff never have to guess what it was for. */
export function chargeDescription(serviceName: string, packageName: string, sessions: number): string {
  const what = sessions === 1 ? `${serviceName} — ${packageName}` : `${serviceName} — ${packageName} (${sessions} treatments)`;
  return `Spa Aella: ${what}`;
}
