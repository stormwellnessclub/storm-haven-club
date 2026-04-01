
# Fix POS Processing Fees Correctly

## What I re-checked in the actual code
The current bug is in the backend, not just the POS pages:

- `src/pages/admin/CafePOS.tsx` and `src/pages/admin/FrontDeskPOS.tsx` already calculate a frontend processing fee and send a fee-inclusive total
- `supabase/functions/stripe-payment/index.ts` then ignores that POS intent and recalculates another fee inside `charge_saved_card`
- the `chargeType: "pos"` flag is being sent by the POS pages, but the backend does not use it
- the backend also does not currently accept a passed POS `processingFee`

So the POS flow is not using one clear source of truth for the fee. That is what needs to be fixed.

## Implementation plan

### 1. Fix the backend POS charge logic
Update `supabase/functions/stripe-payment/index.ts` so POS charges are handled differently from generic admin/manual charges.

For `charge_saved_card`:
- add support for `chargeType` and `processingFee` in the request body type
- when `chargeType === "pos"`:
  - treat incoming `amount` as the final amount to charge
  - use the passed `processingFee` only for metadata/description
  - do **not** run `calculateProcessingFee(amount)` again
  - create the PaymentIntent with `amount` exactly as received
- for all non-POS charges, keep the existing fee calculation behavior unchanged

### 2. Mirror the same safeguard in the 3DS path
Also update `charge_saved_card_with_3ds` in the same file so the same rule exists there too:
- POS-style requests use the passed final amount and passed fee
- non-POS requests keep current behavior

This keeps the logic consistent and prevents the same bug from reappearing elsewhere.

### 3. Make both POS pages send explicit POS fee data
Update:
- `src/pages/admin/CafePOS.tsx`
- `src/pages/admin/FrontDeskPOS.tsx`

Keep the current POS math:
- `subtotal`
- `tax`
- `processingFee`
- `total = subtotal + tax + processingFee`

Send to the backend:
- `amount = Math.round(total * 100)`
- `processingFee = Math.round(processingFee * 100)`
- `subtotal`
- `taxAmount`
- `chargeType: "pos"`
- `stripeCustomerId`

That makes the backend use the exact total shown to staff/customer, without inventing a second fee.

### 4. Keep local order records aligned
Do not change the local order item breakdown:
- taxable items stay the same
- tax line stays the same
- processing fee line stays the same

This keeps `cafe_orders.total_amount` aligned with the Stripe charge total for POS orders.

## Why this is the right fix
The earlier “send subtotal + tax only and let backend add fee” approach would move POS fee logic into the generic backend charge flow and make the POS/cart/order totals easier to drift apart again.

The safer fix is:
- POS computes the exact visible total
- backend charges exactly that amount for POS
- backend only auto-adds fees for non-POS charge flows

## Files to change
- `supabase/functions/stripe-payment/index.ts`
- `src/pages/admin/CafePOS.tsx`
- `src/pages/admin/FrontDeskPOS.tsx`

## No database changes
No schema or policy changes are needed.

## Verification checklist
After implementation, verify these exact cases:

1. **Cafe POS card sale**
   - Stripe charge amount equals POS total exactly
   - metadata includes `subtotal`, `tax_amount`, and `processing_fee`
   - local order total matches Stripe total

2. **Front Desk POS card sale**
   - same checks as above

3. **Cash sale**
   - no processing fee added
   - no Stripe charge attempted

4. **Non-POS admin/manual saved-card charge**
   - existing fee behavior still works
   - no regression in member/admin charging flows

5. **Net result**
   - for POS card transactions, the customer is paying the fee shown on the POS
   - you are not absorbing the Stripe processing fee
   - customers are not double-charged a second fee
