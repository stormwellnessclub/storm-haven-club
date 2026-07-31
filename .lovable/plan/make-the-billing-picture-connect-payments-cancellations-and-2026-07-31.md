# Make the billing picture connect: payments, cancellations, and hidden balances

## What I found (verified, not guessed)

**Summer Daoud — you paid her, the system didn't notice.**
Her $206.29 charge went through today at 5:55pm with your note "past due July 9th". But her June 9 Stripe invoice (`in_1TrKpr…`) is still **open** in Stripe, her `billing_arrears` row is still **unpaid**, and her member status is still `past_due` — so she still gets blocked at check-in. A manual charge today has no link to the invoice it was paying. That's the core bug, and it will happen to every person you collect from by hand.

**Kinda Turaani-Imam — she owes, and she was invisible.**
Her member record points at Stripe customer `cus_U318nkvKLFbZA6`, but her live subscription `sub_1SzGUu…` lives on a **different** Stripe customer, `cus_TtMlZuiRr9Eqr6`. That subscription is `past_due` in Stripe with multiple $200 invoices still open. Our ingestion matches invoices to members **only** by the customer id stored on the member row, so every one of her unpaid invoices was silently dropped. She never showed up on any list. Any member with a second Stripe customer has the same hole.

**Kaitlin Mault — cancelled is not settled.**
She has no unpaid rows because we cancelled her subscription, so Stripe stopped issuing invoices. The debt is contractual, not invoice-backed. Nothing in the system records "cancelled by us for non-payment, still liable."

**Zahna Abdallah** — her Feb 9 invoice is already marked resolved and every invoice since is paid. She owes nothing. Confirmed.

## The fix

### 1. Manual payments settle the balance they paid
A new database routine applies a manual dues charge to that member's oldest outstanding invoices, marks them resolved with your note and your name, and — only when nothing is left outstanding — lifts the past-due flag and puts a `past_due` member back to `active`. Wired into the charge path so it happens automatically every time, not by me remembering.

The matching Stripe invoice gets marked paid out of band so Stripe stops retrying and stops reporting them past due.

### 2. Invoices find their member even when the customer id doesn't match
Ledger ingestion will resolve a member by, in order: Stripe customer id, then subscription id (dues or annual fee), then customer email. Anything that still can't be matched gets logged so unattached money is visible instead of dropped.

### 3. Cancelled members keep their balance
Cancelled members with outstanding invoices stay on the arrears report, labelled **"Cancelled for non-payment — balance still owed"** rather than plain "Cancelled". Cancelling a membership never zeroes the debt.

### 4. Immediate data corrections
- Summer: settle her June invoice against today's payment, note it, unblock check-in.
- Kinda: repoint her member record to the Stripe customer holding her live subscription, then re-run ingestion so her real unpaid invoices land on the report.
- Re-run ingestion across all members after the matching fix, so anyone else hidden by a customer-id mismatch surfaces.

### 5. Aujenique Willis
Left alone as you asked — frozen, $257.78 open from June 26. Flagged for your review, not touched.

## Technical notes

- New `settle_membership_dues_payment(member_id, amount_cents, note, actor_email)` SECURITY DEFINER function; oldest-first allocation across `billing_arrears`, writes `resolution_reason` / `resolved_by_email` / `paid_at`, clears `payment_past_due` and restores status only when total outstanding hits zero. Admin/manager/service_role only.
- Called from `stripe-payment` after a successful member charge whose description is membership dues, initiation, or annual fee; also exposed for the arrears page's "record payment" action.
- `backfill-payment-history` gains `subToMember` and `emailToMember` maps alongside `customerToMember`, plus a skipped-customer log line.
- `BillingArrears.tsx` gains the cancelled-with-balance label and shows the settlement note on resolved rows.
