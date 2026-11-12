// Card charges add the club's processing fee: (amount + $0.30) / (1 - 0.029).
export function processingFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.ceil((amountCents + 30) / 0.971) - amountCents;
}

/** Members pay the package's member price only when staff set one; otherwise the public price. */
export function packagePriceCents(pkg: { price_cents: number; member_price_cents: number | null }, isMember: boolean): number {
  return isMember && pkg.member_price_cents != null ? pkg.member_price_cents : pkg.price_cents;
}

/** What the Stripe charge says, so staff never have to guess what it was for. */
export function chargeDescription(serviceName: string, packageName: string, sessions: number): string {
  const what = sessions === 1 ? `${serviceName} — ${packageName}` : `${serviceName} — ${packageName} (${sessions} treatments)`;
  return `Spa Aella: ${what}`;
}
