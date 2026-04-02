

# Scheduled Downgrade: Stripe Price Update Verification

## Current Flow Analysis

The code correctly handles the scheduled downgrade in three stages:

### 1. Admin Schedules (TierChangeDialog.tsx, line 228-251)
- Saves `pending_tier_change`, `pending_tier_change_at`, `pending_tier_change_by` to the `members` table
- Does NOT touch Stripe yet — correct behavior

### 2. Webhook Triggers (stripe-webhook/index.ts, line 2064-2140)
- On `invoice.payment_succeeded`, fetches the member's `pending_tier_change`
- Looks up the correct Stripe price ID from a hardcoded `MEMBERSHIP_PRICES` map
- Calls `stripe.subscriptions.update()` with the new price and `proration_behavior: 'none'`
- Updates the `membership_type` in the database and clears the pending fields

### 3. Stripe Price Swap (line 2106-2116)
```
stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subItem.id, price: newPriceId }],
  proration_behavior: 'none',
})
```
**This DOES update the actual recurring amount in Stripe.** The next invoice will use the new price.

## Verified: Price IDs Match
The `MEMBERSHIP_PRICES` map in the webhook (lines 2077-2094) matches the price IDs in `src/lib/stripeProducts.ts` exactly. All tiers, billing intervals, and genders are consistent.

## One Issue Found: Processing Fee Not Updated

When the tier changes, the subscription's **processing fee line item** (2.9% + $0.30) is NOT recalculated. The system adds processing fees as a separate recurring line item at subscription creation. After a downgrade (e.g., Platinum $350 → Gold $250), the processing fee still reflects the old tier's amount.

**Example**: Platinum women monthly = $350 → fee = $10.45. After downgrade to Gold ($250), the fee should be $7.55, but it stays at $10.45.

## Proposed Fix

In the webhook's pending tier change handler (around line 2106), after swapping the main price item, also find and update the processing fee line item:

- After the `stripe.subscriptions.update` for the main price, retrieve the updated subscription items
- Find the processing fee item (identified by its price or metadata)
- Calculate the new processing fee based on the new tier price
- Update or replace that line item with the correct fee amount

### Files to change
- `supabase/functions/stripe-webhook/index.ts` — update the pending tier change block to also recalculate the processing fee line item

This is a single-file fix in the webhook function. Everything else (price swap, database update, metadata) is working correctly.

