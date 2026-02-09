
# Jeree Spicer Database Cleanup Plan

## Problem Identified
Jeree Spicer's record has a dead Stripe subscription ID (`sub_1SymWjLyZrsSqLhs6p2z52MB`) that's in `incomplete` status. This blocks the admin from creating a new subscription.

## Solution: Database Migration to Clear Dead Subscription

### Step 1: Clear Jeree Spicer's Stale Subscription ID
Execute a targeted update to clear the `stripe_subscription_id` for Jeree Spicer's member record:

```sql
UPDATE members 
SET stripe_subscription_id = NULL 
WHERE id = 'bbf55603-30ae-4fcc-8b41-76c4afe7e02f';
```

### Step 2: Verify the Fix
After clearing, confirm her record shows:
- `stripe_subscription_id`: NULL
- `status`: pending_activation (unchanged)

This will allow you to create a new subscription for her through the admin Member Detail panel.

---

## Technical Details

| Field | Current Value | After Fix |
|-------|---------------|-----------|
| Member ID | bbf55603-30ae-4fcc-8b41-76c4afe7e02f | (unchanged) |
| Name | Jeree Spicer | (unchanged) |
| Status | pending_activation | (unchanged) |
| stripe_subscription_id | sub_1SymWjLyZrsSqLhs6p2z52MB | **NULL** |
| annual_fee_subscription_id | sub_1SymWWLyZrsSqLhsi55ka2P1 | (unchanged) |

---

## Prevention Already in Place
The webhook update deployed earlier will automatically handle `incomplete` and `incomplete_expired` subscriptions going forward, preventing this from happening again.
