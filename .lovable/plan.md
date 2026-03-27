

# Fix: Cafe POS Processing Fee Not Being Charged

## Problem
The cart UI (`CafePOSCart.tsx`) correctly calculates and displays the processing fee, but the actual Stripe charge in `CafePOS.tsx` line 65 computes:
```
total = subtotal + tax
```
It never includes the processing fee. The customer sees it on screen but isn't charged for it — the club absorbs Stripe's cut.

## Fix

### File: `src/pages/admin/CafePOS.tsx`
- Import `calculateProcessingFeeFromDollars` from `@/lib/processingFee`
- After computing `subtotal + tax`, add the processing fee when paying by card:
  ```
  const processingFee = (paymentMethod === "card" && selectedCustomer?.cardOnFile)
    ? calculateProcessingFeeFromDollars(subtotal + tax) : 0;
  const total = subtotal + tax + processingFee;
  ```
- The `amountCents` on line 70 already uses `total`, so once `total` includes the fee, the charge will be correct
- Also update the `cafe_orders` record to store the processing fee amount (add it to the description or a metadata field so it's tracked)

### One file change, ~5 lines modified.

