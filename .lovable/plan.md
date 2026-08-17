# Fix: Summer Daoud stuck as "payment past due" after paying

## What's actually happening

Summer's balance is settled in the system — her $200 dues invoice is recorded as **paid at 2:20 PM today** — but her account is still flagged past due, so she gets blocked at check-in.

Two records never got closed out when the payment went through:

- Her dunning (payment-recovery) record is still marked **active**
- Her member record still has the **past due** flag turned on

## Why it happened (verified)

The "charge member arrears" / member "retry payment" actions charge the card and mark the invoice paid, but they stop there — they don't close the recovery record or lift the past-due flag. Normally the Stripe payment-succeeded webhook does that cleanup, but for a manually-paid invoice that webhook event never arrived (only a subscription-updated event came through at 2:20 PM), so nothing lifted the block.

Anyone paid off through the admin "charge arrears" button or the member's own "retry payment" button can land in this same state.

## The fix

1. **Clear Summer right now** — re-check her invoice against Stripe and, once confirmed paid, close the recovery record and lift the past-due flag so she can check in.
2. **Close the gap at the source** — after a successful manual charge or member retry, the same cleanup that the webhook does runs immediately: close the recovery record for that invoice, and lift the past-due flag only if the member has no other unpaid invoices or open recovery records.
3. **Safety net for the two odd accounts** — Ayah Boussi and Jeree Spicer are flagged past due with no unpaid invoice and no recovery record behind the flag. Re-check both against Stripe; clear them only if Stripe confirms nothing is owed, and report back rather than clearing blindly.
4. **Stop it recurring silently** — extend the nightly reconciliation so it also catches members flagged past due who have no unpaid invoice at all (today it only inspects accounts that still have an open recovery record).

## Technical notes

- Root cause: success branches of `supabase/functions/charge-member-arrears/index.ts` (~line 140) and `supabase/functions/retry-my-payment/index.ts` (~line 98) update `billing_arrears` only. They do not touch `payment_dunning_state` or `members.payment_past_due`.
- Add a shared helper (e.g. `supabase/functions/_shared/settleInvoiceRecovery.ts`) that mirrors the logic already in `backfill-payment-history` lines 323–361: set the matching dunning row to `recovered`, then clear `payment_past_due` / `payment_past_due_since` only when no `payment_dunning_state` row is `active` and no `billing_arrears` row is `unpaid` for that member. Call it from both success paths.
- `reconcile-dunning-recovery` gains a second pass over `members` where `payment_past_due = true` and there is no active dunning row and no unpaid arrears, verifying against Stripe before clearing.
- Summer's immediate unblock runs through `reconcile-dunning-recovery` scoped to her member id, so Stripe stays the source of truth; no hand-written data edit.
- Also mark her three stale `payment_attempts` rows for invoice `in_1U2Zbf…` as resolved so the admin failed-payments list stops showing her.
