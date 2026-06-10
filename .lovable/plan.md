# Personal Training — Card on File & In-Dialog Charging

## Goal
When admin opens **Sell PT** and picks a customer, the dialog should:
1. Look up that customer's Stripe account, list cards on file, and let admin charge a saved card without leaving the dialog.
2. Work uniformly for **members** and **non-members** (one customer model).
3. Make the resulting PT pass visible to that customer in their portal — member portal or non-member portal.

## Behavior

### Customer lookup
- After selecting a customer in `SellPTDialog`, immediately fetch their Stripe customer + saved payment methods using the existing `stripe-payment` action `admin_list_member_payment_methods` (already used by `useAdminMemberPaymentMethods`). Works for any `user_id` (member or non-member) because lookup keys off the user's email → Stripe customer.
- Display saved card(s) inline: brand, last4, exp, default badge.
- If no card: show "No card on file" with the existing offline / external options as fallback.

### Payment options (radio inside dialog)
1. **Charge card on file** (default when card exists)
2. **Paid offline / in person**
3. **Charged externally**

### Charging (no page leave)
- New payment method `card_on_file` calls existing `stripe-payment` action **`charge_saved_card`** (already supports off-session PaymentIntent + decline handling per project policy: HTTP 200 with `success:false`).
- Pricing: **Gross up** the 2.9% + $0.30 onto the customer using the project's standard formula `(amount + 0.30) / (1 - 0.029)`. Show the pre-fee subtotal, processing fee, and grand total in the dialog before charge.
- **No MI sales tax** on PT (confirmed).
- On success:
  - Insert `pt_passes` row (existing flow).
  - Insert `manual_charges` row so it appears in the member's payment history and sales/financial reports. Metadata includes `pt_pack_id`, `pt_pass_id`, `format`, `sessions`, `subtotal_cents`, `processing_fee_cents`, `total_cents`.
- On Stripe decline: surface the message inline, keep the dialog open with state preserved so admin can retry or switch to offline.

### Portal visibility (members + non-members)
- `MyPTPassesSection` already exists and queries `pt_passes` by `user_id`. Confirm it's mounted on:
  - `/portal/passes` (member portal) — already done.
  - **Non-member portal passes view** — add the same section so non-members see their PT credits and expirations alongside class passes.
- RLS: ensure `pt_passes` SELECT policy allows `auth.uid() = user_id` for both members and non-members (it already does, since it's user-id based — verify, no schema change expected).

## Technical details

**Files to edit**
- `src/components/admin/SellPTDialog.tsx`
  - Add `useAdminMemberPaymentMethods(userId)` once a customer is selected. (Hook currently takes `memberId` — extend or add a sibling hook keyed off `user_id` that calls the same edge action with `userId` instead of `memberId`. The edge function already accepts a user lookup path via email; add a small `admin_list_user_payment_methods` action if needed.)
  - Render saved-card list + payment-method radio.
  - Compute fee gross-up and totals client-side using `src/lib/processingFee.ts`.
  - On submit with `card_on_file`: invoke `stripe-payment` `charge_saved_card` with `amount_cents = grossed-up total`, `paymentMethodId`, and metadata identifying PT pack. Only insert `pt_passes` + `manual_charges` after the PaymentIntent succeeds.
- `supabase/functions/stripe-payment/index.ts`
  - If `admin_list_member_payment_methods` is strictly member-scoped, add `admin_list_user_payment_methods` mirroring it but resolving the Stripe customer by `auth.users.email` for any user (members + non-members).
- Non-member portal passes page (the existing page that shows class passes for non-members): mount `<MyPTPassesSection />`.

**No DB schema changes required.**
- `pt_passes` already has `user_id`, `status`, `sessions_remaining`, `expires_at`.
- `manual_charges` already exists for payment history surfacing.

**Security**
- All charging gated by admin role check inside the edge function (existing `charge_saved_card` already enforces this).
- Off-session PaymentIntent — admin acting on behalf, customer card was previously saved with their consent.

## Out of scope (call out, don't build)
- Collecting a brand-new card inline in the Sell PT dialog (would require Stripe Elements mount). If a customer has no card on file, admin uses offline/external for now, or sends them to add a card via the existing PaymentMethods flow.
- Any change to Stripe products/prices — PT pricing stays in `pt_packs` and is charged ad-hoc via PaymentIntent.
