

# Fix Jeree Spicer's Subscription: Switch to Gold $250/mo

## Problem
Jeree's subscription is `past_due` at the Platinum price ($350/mo). A pending downgrade to Gold is scheduled, but it only triggers on successful payment — creating a loop where the wrong amount keeps failing.

## Plan

### Step 1: Update Stripe subscription immediately
Use Stripe tools to swap Jeree's subscription items from Platinum to Gold pricing:
- Replace `price_1Sl9r7LyZrsSqLhs5RBuy2f7` (Platinum $350) → `price_1Sl9pvLyZrsSqLhsIWyf2WwX` (Gold $250)
- Replace processing fee `price_1T7P36LyZrsSqLhsaoHnruD7` ($10.77 based on $350) → new processing fee for $250 (2.9% + $0.30 = $7.55)

Subscription items:
- `si_U5aDjMB5EdLFNu` — main price → Gold women monthly
- `si_U5aDRA75Iggtff` — processing fee → recalculated for $250

### Step 2: Update database record
Update Jeree's member record:
- `membership_type` → `Gold`
- Clear `pending_tier_change`, `pending_tier_change_at`, `pending_tier_change_by`

### Step 3: Reset credits to Gold tier
Gold credits: 4 Red Light Therapy sessions + 2 Cryo sessions per month (vs Platinum's 6 RL + 4 Cryo). Update or recreate her current-cycle credits to reflect Gold tier allocations.

### Step 4: Fix the webhook logic for future cases
Update `supabase/functions/stripe-webhook/index.ts` so that when `invoice.payment_failed` fires and the member has a `pending_tier_change`, the system applies the downgrade immediately (swaps the Stripe price) before the next retry — preventing the loop of charging the old higher price.

## Files changed
- `supabase/functions/stripe-webhook/index.ts` (add downgrade-on-failure logic)
- Stripe subscription update (tool call)
- Database update (tool call)

