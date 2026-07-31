# Past-due tracking is broken — fix the pipeline, not just Summer

## Answering your three questions

**1. Why did we miss Summer since July 9?**
Because the two tables that record payments and misses both stopped being written:

- newest row in `billing_arrears`: **June 7, 2026**
- newest row in `payment_attempts`: **June 7, 2026**

Nothing has been ingested from Stripe in almost two months. Her July 9 failure never landed anywhere the system looks, so no flag, no banner, no arrears row. The only reason she shows `past_due` at all is a status column someone/something set directly.

**2. Why is she still blocked after you charged her?**
Check-in hard-blocks on `members.status = 'past_due'` and `subscription_status = 'past_due'`. Both are still set on her record. Collecting the money didn't touch them, because the collection path has no step that clears them.

**3. How many people are past due?**
11 members carry some past-due marking today:

| Owes money (dunning row + balance) | Amount |
|---|---|
| Sherene Albosaraj (pending activation) | $750.00 |
| Jeree Spicer (cancelled) | $515.10 |
| Ayah Boussi (cancelled) | $412.58 |
| Mariam Alsheeblawy | $400.00 |

| Flagged past_due, $0 recorded owing — **unverified** |
|---|
| Summer Daoud, Mariam Atwi, Randa Turaani, Rama Alhoussaini, Alyssa Maley, Aujenique Willis (frozen), zeinab barakat |

The second group shows $0 owed **only because the ledger stopped updating in June**. That is not proof they paid. I am not going to clear them on that basis.

## The plan

### 1. Unblock Summer only
You confirmed you collected her balance in person. Set her `status` and `subscription_status` back to `active`. One member, done by hand, no sweep.

### 2. Restore the ingestion pipeline (the actual bug)
Find and fix why `billing_arrears` / `payment_attempts` stopped writing on June 7 — check the Stripe webhook endpoint's recent delivery failures and the `processed_webhook_events` table for the gap. Then backfill every invoice from June 7 to today so the ledger is whole again.

### 3. Verify the other 6, then act individually
Once the backfill runs, each of those members will have real numbers. I'll show you a list — who genuinely owes what — and you decide who gets cleared and who gets collected from. No automatic clearing of anyone.

### 4. Make collection clear the block going forward
Add a step to every money-collection path (manual charge, member retry, `invoice.payment_succeeded` webhook) that clears the past-due status **only** when the member has zero unpaid arrears and no active dunning row against a ledger that is actually current. Gate it on ledger freshness so it can never fire off stale data the way a blanket sweep would.

### 5. Alert on ledger staleness
Add a check that raises a visible admin warning if no new payment row has been written in 72 hours. This is what would have caught the June 7 stall in June instead of you catching it in August.

## Technical notes

- Diagnose the stall via Stripe webhook delivery logs plus `processed_webhook_events` gaps; likely a signature/auth regression around June 7.
- Backfill through the existing `backfill-payment-history` path, extended to write `billing_arrears` rows as well as `payment_attempts`.
- New `clear_member_past_due(uuid)` SECURITY DEFINER function with a freshness guard (`max(created_at) from payment_attempts > now() - interval '72 hours'`), granted to `service_role` and staff roles.
- Staleness alert surfaced on the Membership Health page and in `payment_tracking_health_log`.
