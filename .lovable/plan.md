
## Fix: Cancelled Subscription Still Showing Active in Admin

### Root Cause

Fatima Baydoun (fatima.baydoun236@gmail.com) was refunded and her subscription cancelled in Stripe. The `customer.subscription.deleted` webhook correctly set her `status` to `cancelled`, BUT it did not clear:
- `subscription_status` (still shows `active`)
- `stripe_subscription_id` (still holds the dead subscription ID `sub_1SymSuLyZrsSqLhs4LklB6aq`)
- `annual_fee_subscription_id` (still holds `sub_1SyMsnLyZrsSqLhs1k8NGk1T`)

The `update_subscription_status_with_history` RPC function only updates the `status` column — it does not touch `subscription_status` or subscription IDs.

### Fix

**1. Data Fix for Fatima (Database Migration)**

Run a migration to clear Fatima's stale subscription data:

```sql
UPDATE members 
SET subscription_status = 'none',
    stripe_subscription_id = NULL,
    annual_fee_subscription_id = NULL,
    updated_at = now()
WHERE email = 'fatima.baydoun236@gmail.com';
```

**2. Code Fix in `supabase/functions/stripe-webhook/index.ts`**

In the `customer.subscription.deleted` handler (around line 1068-1084), after calling `update_subscription_status_with_history`, also clear the `subscription_status` and `stripe_subscription_id`:

```
// After the RPC call, also clear subscription data
await supabase.from('members').update({
  stripe_subscription_id: null,
  subscription_status: 'none',
  updated_at: new Date().toISOString()
}).eq('id', memberData.id);
```

This ensures that when a membership subscription is deleted in Stripe, the database fully reflects the cancellation — no stale `subscription_status: active` badge.

### Files Changed

| File | Change |
|------|--------|
| Database migration | Clear Fatima's stale subscription fields |
| `supabase/functions/stripe-webhook/index.ts` | Add subscription_status and stripe_subscription_id clearing in `customer.subscription.deleted` handler |
