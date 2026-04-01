
Goal: fix the café checkout paths so the amount shown to staff/customers is the exact amount actually charged, and so reports no longer make it look like you absorbed the processing fee.

What I found
- Admin POS pages are already sending fee-inclusive totals correctly:
  - `src/pages/admin/CafePOS.tsx`
  - `src/pages/admin/FrontDeskPOS.tsx`
- The main broken café admin flow is `src/components/admin/ChargeItemSelector.tsx`:
  - it displays `Subtotal + Tax + Processing Fee`
  - but it submits `cartTotalBeforeFee` instead of `cartGrandTotal`
  - the button label also shows the pre-fee amount
- The backend also records the wrong amount in `manual_charges`:
  - `supabase/functions/stripe-payment/index.ts` inserts `amount: amount`
  - for fee-bearing charges, that is the pre-fee request amount, not the actual Stripe total
  - so internal records/reports can look like the fee was never charged even when Stripe charged it
- Public café checkout in `src/pages/Cafe.tsx` is also inconsistent:
  - it sends `cartTotal` only
  - it is not using the same café tax/fee breakdown as the admin flows

Implementation plan
1. Fix the admin café charge cart
- Update `src/components/admin/ChargeItemSelector.tsx`
- Submit the fee-inclusive total (`cartGrandTotal`) instead of `cartTotalBeforeFee`
- Pass explicit fee metadata (`processingFee`, `subtotal`, `taxAmount`)
- Update the charge button text so staff sees the real amount being charged

2. Make the backend support “fee already included” charges cleanly
- Update `supabase/functions/stripe-payment/index.ts`
- Add a generic fee-included path for `charge_saved_card` and `charge_saved_card_with_3ds`
- When that flag is present:
  - charge the amount exactly as sent
  - do not recalculate the fee again
- Keep existing non-café/manual fee behavior unchanged

3. Fix backend recordkeeping so reports match reality
- In the same backend file, store the actual charged total in `manual_charges.amount`
- Store the fee-aware description used on the Stripe charge
- This makes café reports and admin history reflect the real charged amount instead of the pre-fee subtotal/tax amount

4. Align the public café checkout
- Update `src/pages/Cafe.tsx`
- Compute subtotal, MI sales tax, processing fee, and total explicitly
- Show that breakdown in the payment dialog
- Send the same fee-inclusive amount/metadata as the admin café flow so the UI and Stripe stay in sync

Technical details
- Files to change:
  - `src/components/admin/ChargeItemSelector.tsx`
  - `src/pages/Cafe.tsx`
  - `supabase/functions/stripe-payment/index.ts`
- Likely no database schema changes needed
- I would leave `src/pages/admin/CafePOS.tsx` and `src/pages/admin/FrontDeskPOS.tsx` mostly as-is, then verify they still behave correctly after the backend cleanup

Verification checklist
- Admin café charge cart: displayed total equals Stripe total exactly
- Public café checkout: displayed total equals Stripe total exactly
- `manual_charges.amount` matches the actual Stripe charge amount
- Café reports no longer undercount fee-bearing charges
- Existing POS card flows still work without double-charging
