# Full billing truth audit — rebuild the ledger from Stripe

## You're right, the review was too shallow

I was reading local status flags. Those flags are unreliable, and I can prove it two ways:

- `billing_arrears` and `payment_attempts` both stopped receiving rows on **June 7, 2026**. Almost two months of invoices, failures and payments were never recorded. Any "$0 owed" in our database means "no data", not "paid".
- Looking someone up by flag misses whole categories. **Kinda Turaani-Imam** is `status = active` with `subscription_status = canceled` — she never appeared in my past-due list because she isn't flagged past due, yet she's an active member with no live subscription. **Kaitlin Mault** is marked cancelled with a Stripe customer still attached.

So the correct scope is not "the 11 flagged people." It is all **197 members** (119 active, 69 cancelled, 5 frozen, 2 pending, 2 past due), reconciled against Stripe one by one.

## The plan

### 1. Fix the ingestion stall first
Find why writes to `billing_arrears` / `payment_attempts` stopped on June 7 — inspect Stripe webhook delivery failures and gaps in `processed_webhook_events`. Nothing downstream is trustworthy until new invoices are landing again.

### 2. Full Stripe reconciliation for every member
For each of the 197 members with a Stripe customer, pull the complete invoice history and compute, from Stripe rather than from our tables:

- every unpaid, open, or uncollectible invoice, with amount and age
- every failed charge and its decline reason
- the true subscription state (active, past_due, unpaid, canceled, paused, none)
- whether an active/frozen member has any live subscription at all
- card on file and its expiry

Write all of it back into `billing_arrears` and `payment_attempts` so history is complete from account creation to today, not just post-June-7.

### 3. Produce the "who owes us" report
One page listing every member with a real outstanding balance, sourced from Stripe, sorted by amount. Columns: member, status, amount owed, oldest unpaid invoice date, days outstanding, last successful payment, card on file, subscription state. Includes the categories flag-based checks miss:

- active member, no subscription in Stripe (Kinda's case)
- active member, subscription canceled or unpaid
- cancelled member with an unpaid balance still open (Jeree, Ayah)
- frozen member whose dues were never actually paused (Aujenique — flagged for your review, not auto-touched)
- pending activation with an unpaid initiation fee (Sherene)

You review that list and decide per person. Nothing gets cleared automatically.

### 4. Unblock Summer
Separately and by hand, since you confirmed you collected from her: set her status back to active so she can check in.

### 5. Stop it happening again
- Every collection path clears past-due status only when the ledger is current and the balance is genuinely zero.
- A staleness alarm fires if no payment row has been written in 72 hours.
- Membership Health gains an "active member, no live subscription" tile so Kinda-type gaps surface on their own.

## Technical notes

- Extend `sync-membership-truth` into a full reconciliation: paginate `invoices.list` per customer with no date cap, upsert `billing_arrears` keyed on `stripe_invoice_id`, upsert `payment_attempts` keyed on charge/intent id. Batch across invocations to stay inside the function timeout.
- Reconcile all members with a `stripe_customer_id` regardless of local status, so cancelled members with open balances are included.
- Report page reads the rebuilt ledger, not live Stripe, so it loads fast.
- Freshness guard on `clear_member_past_due(uuid)`; staleness alarm written to `payment_tracking_health_log`.
