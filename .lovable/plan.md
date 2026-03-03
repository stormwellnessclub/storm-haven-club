

# Why Gold Member Credits Keep Disappearing — Root Cause & Fix

## What's Happening

**40 of your active members** (including Lauren Ogarek) have their `subscription_status` stuck at `"none"` in the database, even though they have valid Stripe subscriptions. This is causing two cascading failures:

### Problem 1: Benefits show as "Frozen"
The member portal checks `subscription_status` and only accepts `"active"` or `"trialing"`. When it sees `"none"`, it treats the member as having **no subscription at all** and freezes all their benefits — even though they're paying and their membership status says "active."

Lauren Ogarek's data right now:
- `status`: active
- `stripe_subscription_id`: exists (valid)
- `subscription_status`: **none** ← this is the problem

### Problem 2: Credits disappear / never get provisioned
Lauren has **zero credits** in the database. The monthly credit provisioning job runs correctly, but if benefits were frozen when credits should have been allocated (or if the system didn't re-provision after a status change), credits simply don't appear. There's no recovery mechanism.

### Why `subscription_status` is stuck at "none"
The sync function exists but it's only triggered manually. The Stripe webhook should update this column, but for these 40 members, it either never fired or the update didn't stick during initial onboarding. The value `"none"` is the default, and nothing ever changed it.

---

## The Fix (3 parts)

### 1. Run a Stripe sync to fix the 40 broken members immediately
Call the existing `sync-subscription-status` edge function to pull actual subscription statuses from Stripe and update the database. This will fix all 40 members in one shot.

### 2. Fix the code so "none" doesn't freeze benefits
Update `usePaymentStatus.ts` so that when `subscription_status` is `"none"` but a valid `stripe_subscription_id` exists and the member `status` is `"active"`, the system treats it as having an active subscription instead of freezing benefits. This prevents the problem from recurring if the webhook misses an update.

**File:** `src/hooks/usePaymentStatus.ts` (lines 60-63)

Current logic:
```typescript
const hasActiveSubscription = isCashBilling ? true : (
  !!membership.stripe_subscription_id && 
  ['active', 'trialing'].includes(subscriptionStatus || '')
);
```

Fixed logic — also accept `"none"` or empty when a subscription ID is present:
```typescript
const hasActiveSubscription = isCashBilling ? true : (
  !!membership.stripe_subscription_id && 
  !['incomplete', 'incomplete_expired', 'canceled', 'unpaid'].includes(subscriptionStatus || '')
);
```

This flips the logic from an allowlist (`active`/`trialing` only) to a blocklist (only block known-bad statuses). If `subscription_status` is `"none"` or hasn't synced yet, but the subscription ID exists, the member is treated as active.

### 3. Provision missing credits for affected members
After the sync fixes `subscription_status`, manually trigger the `process-monthly-credits` function to provision credits for members like Lauren who are missing them. Additionally, add a one-time data fix to create current-cycle credits for all Gold+ members who should have them but don't.

**Database migration:** Insert missing credits for active Gold/Platinum/Diamond members whose current billing cycle has no credits.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/usePaymentStatus.ts` | Switch `hasActiveSubscription` from allowlist to blocklist logic |
| Database migration (SQL) | Backfill missing credits for current cycle for affected members |
| Edge function call | Trigger `sync-subscription-status` to fix the 40 members' `subscription_status` |

