

# Fix: Subscription Cleared By Wrong Webhook Event

## What Happened to Sherene

1. She had subscription `sub_1Synwi...` created in February — $250 paid successfully
2. A second subscription `sub_1SyMm7...` was also created (possibly an admin action or duplicate)
3. Subscription #1 was canceled in Stripe
4. The webhook received the cancellation event, found Sherene by her Stripe customer ID, and **blindly cleared `stripe_subscription_id` to null** — without checking if the canceled subscription matched the one stored in the database
5. Now her database shows "Subscription: None" despite having an active subscription (#2) in Stripe
6. Her March invoice ($250) is **open/unpaid** — Stripe is trying to collect but something is blocking it

## The Bug

In `supabase/functions/stripe-webhook/index.ts`, when handling `customer.subscription.updated` (line 1442-1456) and `customer.subscription.deleted` (line 1566-1574), the code:
- Looks up the member by `stripe_customer_id`
- Clears `stripe_subscription_id = null` without verifying the canceled subscription ID matches the member's stored subscription ID

This means **any** subscription cancellation for that customer wipes the member's subscription reference, even if a different (active) subscription exists.

## Fix

### 1. Webhook: Only clear subscription if IDs match
In `stripe-webhook/index.ts`, for both the `customer.subscription.updated` (canceled/incomplete_expired handling) and `customer.subscription.deleted` events:
- Before clearing `stripe_subscription_id`, check if `memberData.stripe_subscription_id === subscription.id`
- If they don't match, log a warning but **don't clear** — the canceled subscription isn't the one we're tracking

### 2. Webhook: Same fix in sync-subscription-status
Apply the same guard in `sync-subscription-status/index.ts` (lines 270-299) — only clear if the subscription being synced matches the stored one.

### 3. Immediate data fix for Sherene
- Update her `stripe_subscription_id` to `sub_1SyMm7LyZrsSqLhsqBJ7yEKu` (the active one)
- Update `subscription_status` to `active`
- The open March invoice needs attention in Stripe — it's $250 unpaid

### 4. Cancel the canceled subscription reference cleanup
Also consider: should subscription #1 have been canceled? Or was it a mistake? You may want to cancel sub #2 and keep just one clean subscription going forward. That's a business decision.

## Files to modify
| File | Change |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | Add subscription ID match check before clearing (2 locations) |
| `supabase/functions/sync-subscription-status/index.ts` | Add subscription ID match check before clearing |
| Database update (via insert tool) | Fix Sherene's record to point to active subscription |

