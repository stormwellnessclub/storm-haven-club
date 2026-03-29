

# Fix Sales Tax Report — Tax Data Missing from Stripe Metadata

## Problem
The Sales Tax report shows $0 because tax amounts are never stored in Stripe charge metadata. The cart UI calculates 6% MI sales tax correctly, but doesn't pass it to the edge function, so the Stripe PaymentIntent metadata has no `tax_amount` or `subtotal` fields. The sales tax report edge function looks for these fields and finds nothing.

## Root Cause Chain
1. `ChargeItemSelector.tsx` calculates `cartCafeTax` and `cartSubtotal` but only sends `amount` (total) and `description` to the edge function
2. `stripe-payment` edge function creates PaymentIntents with `metadata: { type: 'manual_charge' }` — no tax fields
3. `stripe-sales-tax` edge function checks `metadata.tax_amount` and `metadata.subtotal` — always empty → tax = 0 → filtered out

## Fix (3 files)

### 1. ChargeItemSelector.tsx — Send tax data with charge request
Pass `taxAmount` and `subtotal` (in cents) alongside the existing `amount` field in the charge body sent to the edge function. Also include the charge category (`payment_type`) so the sales tax report can categorize it (café, merch, etc.).

### 2. stripe-payment edge function — Store tax in Stripe metadata
In both `charge_saved_card` and `charge_saved_card_with_3ds` handlers, read the new `taxAmount`, `subtotal`, and `payment_type` fields from the request body and include them in the PaymentIntent `metadata` as `tax_amount`, `subtotal`, and `type` (overriding the generic `manual_charge` with the specific category when available).

### 3. stripe-sales-tax edge function — Improve tax detection for manual charges
The existing metadata lookup logic (`metadata.tax_amount`, `metadata.subtotal`) should work once the data is present. Add a fallback: for charges with `type: manual_charge` where the description contains "MI 6% tax", back-calculate the tax from the total. This covers all historical charges that were created before this fix.

## Result
- All **future** café/merch charges will have explicit tax metadata in Stripe → report picks them up
- All **historical** charges with "(incl. MI 6% tax)" in the description will be back-calculated → retroactive visibility
- Non-taxable charges (memberships, class passes) remain unaffected

