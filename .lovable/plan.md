

## Fully stop billing Sarah Siddiqui + prevent orphaned invoices on any future cancellation

### Current state (verified just now)

- DB: `members.status = 'cancelled'`, `stripe_subscription_id = NULL`, `subscription_status = 'none'` ✅
- Stripe subs: both already `canceled` ✅
- **Problem:** Stripe still has one **open $250 invoice** (`in_1T8xcJLyZrsSqLhsyNuB7rRg`, billing reason `subscription_cycle`) that was generated *before* the cancellation finalized. It's mirrored in `billing_arrears` (id `ca64de9b-7087-4a22-b5cd-c457cf28ba58`) as `unpaid`.
- Stripe will keep retrying that open invoice and emailing her about it until it's voided. That's the active "billing" she's still seeing.

### Fix — three parts

**Part 1: Clean up Sarah right now (one-time)**

1. Void the open Stripe invoice `in_1T8xcJLyZrsSqLhsyNuB7rRg` via Stripe API (no charge, no email retries).
2. Update the matching `billing_arrears` row to `status = 'voided'`, set `resolved_at = now()` with reason `membership_cancelled_post_invoice`.
3. Confirm no other open invoices, payment intents, or scheduled charges remain on `cus_TtKwAlQEoW88aj`.
4. Detach her saved payment methods in Stripe so nothing can be charged manually by mistake.

**Part 2: Fix the cancellation flow so this never happens again**

Update the membership-cancellation code path (`cancel-membership` edge function + `MemberDetail` cancel action) to, in this order:

1. Cancel both Stripe subscriptions (dues + annual fee) with `invoice_now: false, prorate: false` — already done.
2. **NEW:** List all open invoices for that customer and `void` any whose `subscription` matches the just-cancelled subs OR whose `billing_reason` is `subscription_cycle` / `subscription_create`.
3. **NEW:** For each voided invoice, mark the matching `billing_arrears` row as `voided` with `resolved_at = now()` and reason `membership_cancelled`.
4. **NEW:** Detach saved payment methods (configurable — default on for cancellations, off for freezes).
5. Log the cleanup actions to `audit_logs` so staff can see exactly what was voided.

**Part 3: Stripe webhook hardening**

In `stripe-webhook` `invoice.created` and `invoice.finalized` handlers:
- Before mirroring a new arrears row, check if the member's `status` is `cancelled` or `expired`.
- If yes: immediately void the invoice in Stripe and skip creating the arrears row. Log a warning to `audit_logs` with reason `invoice_received_for_cancelled_member`.
- This catches any race condition where Stripe generates one more invoice between the cancel call and the subscription actually closing.

### Verification after deploy

1. Sarah's Stripe customer page → no open invoices, no active subs, no saved cards
2. Sarah's profile in admin → no arrears, no "Confirmed Payment Issues", check-in correctly denied because `status = cancelled`
3. Cancel a test member with an open invoice → invoice voided automatically, arrears row marked voided, no further Stripe emails

### Files / objects touched

**One-time SQL + Stripe ops** (no code change, executed once)
- Void `in_1T8xcJLyZrsSqLhsyNuB7rRg` via Stripe API
- Update `billing_arrears` row `ca64de9b-7087-4a22-b5cd-c457cf28ba58` → `voided`
- Detach Sarah's payment methods

**Edge functions**
- `supabase/functions/cancel-membership/index.ts` — add open-invoice void sweep + payment-method detach + audit log
- `supabase/functions/stripe-webhook/index.ts` — add guard in `invoice.created` / `invoice.finalized` to auto-void invoices for cancelled members

**Frontend**
- No UI changes needed; the existing cancel button will now produce a clean cancellation

