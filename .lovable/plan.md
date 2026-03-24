

# Fix Sherene's Billing — Complete Recovery Plan

## The Situation
- Her monthly dues subscription (`sub_1Synwi...`) is **canceled in Stripe** — can't be uncanceled
- Her only active subscription (`sub_1SyMm7...`) is the **annual initiation fee** ($300/yr) — not dues
- The database currently has `stripe_subscription_id` pointing to the wrong subscription (the annual fee one)
- She was never charged for March dues ($250)
- There's an orphaned open invoice (`in_1T8xIC...`) from the canceled sub

## What I'll Do (3 steps)

### Step 1: Fix her database record
Clear `stripe_subscription_id` and `subscription_status` — they're currently pointing to her annual fee sub, not a dues sub. Her `annual_fee_subscription_id` stays as-is (that's correct).

### Step 2: Charge March dues as a one-time invoice
Use the Stripe tools to create and finalize a one-time invoice for $250 + processing fees against her existing customer (`cus_TtOsmHEP7aEKZw`). This charges her card on file immediately for the missed March payment.

### Step 3: Create a new monthly dues subscription starting April 9th
Use the existing `admin_create_member_subscription` edge function action with:
- Tier: Gold, Gender: Women, Billing: Monthly
- `firstChargeDate`: April 9, 2026 (sets `billing_cycle_anchor` so first charge is April 9th, then recurring monthly on the 9th)
- This will create a brand new Stripe subscription, update her `stripe_subscription_id` in the DB, set status to `active`, and allocate credits

### Step 4: Void the orphaned invoice
The old open invoice from the canceled subscription gets voided so she's not double-charged.

### Result
- March: One-time charge of ~$257.55 ($250 + 2.9% + $0.30)
- April 9th onward: New recurring subscription, $250/mo + fees, auto-billing on the 9th
- Database correctly reflects her active dues subscription
- Annual fee subscription untouched

