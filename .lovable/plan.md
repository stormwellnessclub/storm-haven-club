# Show charge breakdown before "Charge Now"

## Problem
In the admin Create Subscription dialog (e.g. Gold Founding = $3,000/yr), the confirm button just says "Charge Now & Create" and shows only the base membership price. The backend already adds the 2.9% + $0.30 Stripe processing fee as a recurring line item via `addRecurringProcessingFeeItems`, and (for any member without `annual_fee_paid_at`) also creates a separate $300 women / $175 men annual fee subscription with its own processing fee. The admin can't see any of this before clicking Charge Now.

## Goal
Make the dialog transparently show exactly what Stripe will charge today, using the same formula the backend uses, so the admin sees the full breakdown before confirming.

## Changes (frontend only — `src/components/admin/CreateSubscriptionDialog.tsx`)

1. **Pull in the existing helpers** so client and server use the same math:
   - `calculateProcessingFeeFromDollars` from `src/lib/processingFee.ts`
   - `getAnnualFeeAmount` from `src/lib/stripeProducts.ts`

2. **Accept two extra props** from `MemberDetail.tsx` (already known there) so we know whether the annual fee will also be charged today:
   - `annualFeePaidAt: string | null`
   - `annualFeeSubscriptionId: string | null`
   The annual-fee line is included only when both are falsy (matches backend `alreadyPaidInDB` / `hasLinkedSubscription` skip logic).

3. **Build a charge breakdown** inside `subscriptionPreview` (or a sibling memo):
   - `membershipBase` = current PRICES lookup ($3,000 for Gold founding women)
   - `membershipFee` = `calculateProcessingFeeFromDollars(membershipBase)`
   - `annualFeeBase` = `getAnnualFeeAmount(gender)` when the annual fee will be created, else 0
   - `annualFeeFee` = processing fee on `annualFeeBase`
   - `chargeTotalToday` = sum of the above when `paymentMode === "now"`, else 0 (deferred / cash modes don't charge today)

4. **Render a "Today's charge" card** above the existing "Important" amber box, only when the card will actually be charged today (i.e. `isChargingNow` is true and there's a card on file). Layout:
   ```
   Membership (Gold • Annual)           $3,000.00
   Processing fee (2.9% + $0.30)           $89.80
   Annual fee (Women)                     $300.00   ← only if applicable
   Processing fee                           $9.30
   ─────────────────────────────────────────────
   Total charged today                  $3,399.10
   ```
   Use muted text for line labels, foreground for amounts, a divider before the total, and bold the total. Currency formatted via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.

5. **Update the confirm button label** so the amount is visible on the button itself:
   - Charge-now: `Charge $3,399.10 Now & Create`
   - Scheduled future date: `Schedule $3,399.10 for Nov 12, 2026`
   - Cash paid ahead / first month: keep `Activate & Schedule Future Billing` (nothing charged today)

6. **Deferred-billing summary card** (the existing "Billing Summary" box for `cash_paid_ahead` / `custom`): add a single line `First Stripe charge total: $X,XXX.XX` using the same breakdown total so the admin knows what the future charge will be.

7. No backend changes. The numbers in the dialog are display-only and computed with the exact same formula the edge function uses (`ceil((base + 30) / 0.971) - base`), so what the admin sees matches what Stripe charges.

## Out of scope
- Toggling who pays the fee (member vs club). The project memory locks this as "member pays via gross-up"; this plan only surfaces that fee in the UI.
- Changing the backend subscription creation flow.
- Sales tax (memberships aren't taxed in current flow).

## Files touched
- `src/components/admin/CreateSubscriptionDialog.tsx` — add breakdown card, update button label, accept two new props.
- `src/pages/admin/MemberDetail.tsx` — pass `annual_fee_paid_at` and `annual_fee_subscription_id` from the loaded member into the dialog (one-line prop additions at the existing `<CreateSubscriptionDialog ... />` usage near line 2651).
