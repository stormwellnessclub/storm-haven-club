# Fix: members blocked at check-in after their payment succeeded

## What's actually happening with Fatima Zreik

Her Stripe invoice (`in_1U2MpH…`, $257.78, Aug dues) **is paid** — Stripe shows `status: paid`, paid on attempt 2 at Aug 10, 06:54 UTC. Her arrears row is also marked `paid`.

But two things never got cleared:

- Her dunning record is still `status = active` (opened Aug 9 when the first attempt failed, never marked recovered).
- Her member record still has `payment_past_due = true`.

The scanner blocks on `payment_past_due`, so she's denied even though nothing is owed.

## This is not just her

Cross-checking every active dunning record against its Stripe invoice, six members are stuck the same way — flagged past due while their invoice is paid or voided:

- Fatima Zreik (paid Aug 10)
- Victoria Elaine Fletcher (paid Aug 10)
- Maryam Hachem (paid Aug 9)
- Susu Berry (paid Aug 4)
- Jeree Spicer (invoice voided)
- Ayah Boussi (invoice voided)

(The other ten active dunning rows are genuinely unpaid and should stay blocked.)

Root cause: the "clear the past-due flag" logic only runs inside the `invoice.payment_succeeded` webhook branch. When a payment lands on a Stripe smart retry, or an invoice is voided/paid outside that path, the arrears row gets corrected later by the nightly backfill job — but that job never touches `payment_dunning_state` or `members.payment_past_due`, so the block sticks forever.

## Plan

### 1. Immediate cleanup (data fix)
For each member whose active dunning invoice is `paid` or `void` in Stripe: mark the dunning row `recovered`, and clear `payment_past_due` / `payment_past_due_since` when they have no remaining genuinely-unpaid dunning rows or unpaid arrears. This unblocks Fatima and the other five today.

### 2. Close the gap so it stops recurring
- Extend the nightly reconciliation to be the safety net: for every `active` dunning row, look up the invoice in Stripe; if it is `paid` or `void`, mark it recovered and re-evaluate the member's `payment_past_due` flag.
- Have the arrears backfill/reconcile path re-evaluate the flag whenever it flips an arrears row to `paid`, instead of only updating the arrears table.
- Also handle Stripe's `invoice.paid` event (not just `invoice.payment_succeeded`) in the webhook so retry recoveries clear immediately.

### 3. Visibility for staff
On the admin member billing view, when a member is flagged past due but has no unpaid arrears, show a "past-due flag looks stale" note with a one-click **Re-check with Stripe** action that runs the same reconciliation for that member.

## Technical notes
- Files: `supabase/functions/stripe-webhook/index.ts` (dunning recovery + `invoice.paid` case), `supabase/functions/backfill-payment-history/index.ts` (flag re-evaluation on arrears paid), plus a reconciliation routine invoked by cron and by the admin button.
- Flag clearing rule stays conservative: clear only when zero active dunning rows and zero unpaid `billing_arrears` remain for that member — genuine debtors keep their block.
- No change to `evaluate_member_check_in_eligibility`; the block logic is correct, the data feeding it was stale.
