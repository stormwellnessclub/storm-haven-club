I’ll fix the late-payment credit issue at the root, not just date formatting.

Plan:

1. **Make credit issuance idempotent by invoice**
   - Add a small backend ledger for monthly credit grants keyed by `stripe_invoice_id + credit_type`.
   - This prevents duplicate credits if Stripe retries the same webhook, while still allowing a late paid invoice to grant credits once.

2. **Replace fragile insert-only webhook logic**
   - Update `stripe-webhook` so `invoice.payment_succeeded` does not just `.insert()` credits and silently log conflicts.
   - It will call one atomic database function that:
     - verifies the invoice has not already granted that credit type,
     - finds or creates the correct current usable cycle row,
     - adds the monthly allocation to `credits_total` and `credits_remaining` when appropriate,
     - extends `cycle_end/expires_at` so paid-late credits are usable,
     - records the grant against the invoice.

3. **Handle late payments correctly**
   - If the paid invoice period is already stale, credits will be granted into the current usable cycle instead of an expired cycle.
   - If an existing current row exists, the system will top it up instead of failing on the unique constraint.
   - Silver remains unchanged because Silver has no monthly credits.

4. **Backfill affected active members**
   - Run a targeted backend repair for active Gold/Platinum/Diamond members with successful dues payments but missing/stale monthly credits.
   - Exclude cancelled members and respect frozen/benefit-blocked rules where applicable.

5. **Verify**
   - Query the affected members after the migration to confirm each expected credit type exists and is usable.
   - Deploy the updated webhook function.

Technical details:

```text
Current failure mode:
Stripe invoice.payment_succeeded
  -> webhook computes cycle_start
  -> checks existing member_credits by cycle_start
  -> batch inserts rows
  -> unique conflicts / expired cycles are only logged
  -> member may remain without usable credits

New behavior:
Stripe invoice.payment_succeeded
  -> grant_monthly_membership_credits(invoice_id, member_id, cycle, tier)
  -> atomic invoice ledger + member_credits create/update
  -> no duplicates, no stale expiration, no silent skipped credits
```