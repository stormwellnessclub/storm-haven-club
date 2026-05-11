## Diagnosis

Rola Taleb (member `STM-000169`) — DB row is out of sync with Stripe.

| Field | DB value | Stripe reality |
|---|---|---|
| `status` | `active` ✓ | — |
| `stripe_subscription_id` | `sub_1TVl1pLyZrsSqLhs8niKfqCj` | exists, status = **`active`** |
| `subscription_status` | **`incomplete_expired`** ✗ | should be `active` |
| `billing_arrears` | none | — |

The check-in RPC `evaluate_member_check_in_eligibility` returns `denial_reason = 'subscription_incomplete_expired'` because of this single stale field:

```
IF subscription_status IN ('past_due','unpaid','canceled','incomplete_expired')
   → access_granted = false
```

So the check-in screen correctly reports "payment issue" — the DB still thinks her sub never activated, even though Stripe successfully charged her first month on `sub_1TVl1pLyZrsSqLhs8niKfqCj`.

### Why it didn't auto-fix
When the new subscription `sub_1TVl1pLyZrsSqLhs8niKfqCj` finalized in Stripe, the `customer.subscription.updated` / `invoice.paid` webhook either didn't fire or didn't match this member row (her DB still pointed at the new sub id, so it should have matched — likely a missed/failed webhook event, not a logic bug). Two prior subs on the same customer are `incomplete_expired`, which is normal history.

## Fix (two parts)

### 1. Unblock Rola now (one-row hotfix)

Migration that sets her `subscription_status` to match Stripe so she can check in immediately:

```sql
UPDATE public.members
SET subscription_status = 'active',
    updated_at = now()
WHERE id = '0b85aa39-5af2-4416-aa22-a1f003c1456d'
  AND stripe_subscription_id = 'sub_1TVl1pLyZrsSqLhs8niKfqCj';
```

No code changes for the hotfix.

### 2. Prevent recurrence — "Sync from Stripe" on the member admin page

The project already has a bulk `sync-subscription-status` edge function. Add a per-member trigger so admins don't need to wait for a webhook after manually fixing a payment:

- **Edge function**: accept an optional `member_id` in the request body and, when present, sync only that member (reuse the existing per-member sync logic inside `sync-subscription-status/index.ts`). Single-row mode skips the bulk loop and returns the resolved status.
- **Admin UI**: on the member detail page (and on the "Payment issue" denial banner inside the front-desk scanner result), add a **"Sync from Stripe"** button that:
  1. Calls `sync-subscription-status` with `{ member_id }`.
  2. Shows a toast with the result (e.g. "Updated subscription_status: incomplete_expired → active").
  3. Invalidates the member query so the scanner re-evaluates immediately.

This gives the front desk a one-click recovery whenever Stripe and the DB drift, without waiting for the next webhook or running the bulk job.

## Out of scope

- No changes to `process_member_scan` or `evaluate_member_check_in_eligibility` logic — they're correct, the input was stale.
- No webhook rework. If drift keeps happening, we can investigate webhook delivery separately.
- No changes to billing/subscription flow itself.

## Files touched

- **Migration** — one `UPDATE` on `members` for Rola.
- `supabase/functions/sync-subscription-status/index.ts` — add single-member mode.
- Member admin detail component + scanner "payment issue" denial card — add **Sync from Stripe** button + handler.

Want me to proceed with both the hotfix migration and the single-member sync button, or just the hotfix for now?