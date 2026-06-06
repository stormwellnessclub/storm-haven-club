
## What's wrong (confirmed in Jeree's data)

Jeree's `members.stripe_subscription_id` is **NULL**, but Stripe still has her active dues subscription with new invoices each month.

- Stripe invoice `in_1TWfDI…` ($257.55, created May 9) — **not in our DB at all**
- Stripe invoice `in_1TLmuR…` ($257.55) — Stripe says **paid**, our DB still says **unpaid**
- Stripe invoice `in_1TIdq7…` ($360.77, March→April cycle) — correctly **unpaid** in DB

### Why nothing is auto-updating

`supabase/functions/stripe-webhook/index.ts` finds the member with:

```ts
.eq('stripe_subscription_id', invoice.subscription)   // dues
// then fallback:
.eq('annual_fee_subscription_id', invoice.subscription)
```

Both lookups fail for Jeree (her `stripe_subscription_id` is null), so:
- `invoice.payment_failed` → no arrears row is upserted → May/June never appear
- `invoice.payment_succeeded` → status never flips to `paid` → April still shows unpaid

`sync_member_arrears` works (it queries by `stripe_customer_id`), but it only runs when an admin clicks **Sync from Stripe**, so the page is stale until then.

This isn't just Jeree — any member whose `stripe_subscription_id` was nulled out previously (cancel/freeze/old webhook) has the same silent gap.

## The fix

### 1. Webhook: customer-based fallback + self-heal

In `supabase/functions/stripe-webhook/index.ts`, for `invoice.payment_failed`, `invoice.payment_succeeded`, and `invoice.payment_action_required`:

1. Try `stripe_subscription_id` (current behavior).
2. Try `annual_fee_subscription_id` (current behavior).
3. **NEW** — fallback: look up the member by `stripe_customer_id = invoice.customer`. Decide dues vs annual fee by scanning the invoice's line-item price IDs against the annual-fee price set (`price_1SlA2BLyZrsSqLhs8VX17F0C`, `price_1SlA2RLyZrsSqLhsK3XQuANN`); everything else is dues.
4. **Self-heal**: when fallback matches, write the discovered `invoice.subscription` back to the member (`stripe_subscription_id` for dues, `annual_fee_subscription_id` for annual fee) — only if that column is currently null, never overwrite an existing value.
5. After member is resolved, run the existing arrears upsert path unchanged (this already handles `paid` / `unpaid` / `partial` / `void` / `uncollectible`).

### 2. Webhook: handle `invoice.finalized` too

Add a new case for `invoice.finalized` (fires the moment Stripe creates the monthly cycle invoice, before the first charge attempt). Same member-resolution chain as #1, then upsert a `billing_arrears` row with status `unpaid` (or `open`). This makes May/June/July show up on the day Stripe bills them — no waiting for the first decline, no waiting for a manual sync.

### 3. Backfill Jeree right now (one-off data fix)

- Restore her `members.stripe_subscription_id` to her live dues subscription (identified by scanning her customer's active/past_due Stripe subs, excluding the annual-fee sub).
- Run `sync_member_arrears` for her — this pulls all open/paid/void/uncollectible invoices and reconciles the rows, so April flips to paid and May/June (and any further cycles) appear with correct totals.

### Out of scope

- No DB migration.
- No changes to `charge-member-arrears`, the Arrears UI, or `reconcile-arrear`.
- No change to Stripe Smart-Retry / past_due policy (already correct).
- No mass backfill of every member tonight — the webhook + finalized handler will self-heal them as their next invoice event arrives. We can add a one-click "Sync all past-due members" admin button as a follow-up if you want.

### Files touched

- `supabase/functions/stripe-webhook/index.ts` — add customer-id fallback + self-heal in 3 invoice cases; add `invoice.finalized` case.
- Data backfill for Jeree only (no code change).

### How we'll verify

1. Jeree's `/admin/members/<id>` page shows: April `$360.77` unpaid, May `$257.55` unpaid, June `$257.55` unpaid (or whatever Stripe currently has open), April-13 proration flipped to paid if Stripe paid it.
2. Total owed badge matches the sum of remaining-due invoices in Stripe.
3. Trigger a test `invoice.payment_failed` (or wait for the next real one) → arrears row appears within seconds with no manual sync.
4. Next monthly cycle invoice triggers `invoice.finalized` → row appears immediately at the start of the cycle.
