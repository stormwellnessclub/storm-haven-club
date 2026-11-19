// Shared rules for The Seasonal Edit class packages (The Movement Edit).
export const processingFeeCents = (amountCents: number) =>
  Math.round((amountCents + 30) / (1 - 0.029)) - amountCents;

/** Expiry timestamp from purchase time and the offer's day count. */
export function seasonalExpiry(purchasedAt: Date, expiryDays: number): Date {
  const d = new Date(purchasedAt.getTime());
  d.setUTCDate(d.getUTCDate() + expiryDays);
  return d;
}
