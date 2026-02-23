/**
 * Processing Fee Calculator
 *
 * Calculates the Stripe processing fee (2.9% + $0.30) that is passed through
 * to the customer as a transparent "Processing Fee" line item.
 *
 * Formula:
 *   total = ceil((base_amount_cents + 30) / 0.971)
 *   processing_fee = total - base_amount_cents
 *
 * This ensures the club receives exactly the base amount after Stripe deducts its fee.
 */

/**
 * Calculate the processing fee in cents for a given base amount in cents.
 */
export function calculateProcessingFee(amountInCents: number): number {
  if (amountInCents <= 0) return 0;
  const totalCents = Math.ceil((amountInCents + 30) / 0.971);
  return totalCents - amountInCents;
}

/**
 * Calculate the processing fee in dollars for a given base amount in dollars.
 */
export function calculateProcessingFeeFromDollars(amountInDollars: number): number {
  if (amountInDollars <= 0) return 0;
  const amountInCents = Math.round(amountInDollars * 100);
  const feeCents = calculateProcessingFee(amountInCents);
  return feeCents / 100;
}

/**
 * Calculate the total (base + fee) in dollars for a given base amount in dollars.
 */
export function calculateTotalWithFee(amountInDollars: number): number {
  return amountInDollars + calculateProcessingFeeFromDollars(amountInDollars);
}
