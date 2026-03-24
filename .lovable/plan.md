

# Fix Sherene's Billing: Charge March + Set Up Recurring Dues

## Current State
- **Member**: Sherene Albosaraj (STM-000122, cus_TtOsmHEP7aEKZw)
- **Tier**: Gold, monthly billing, $250/mo (women's pricing)
- **Database**: `stripe_subscription_id` incorrectly points to her annual fee sub (`sub_1SyMm7...`)
- **Reality**: She has NO monthly dues subscription in Stripe — only the annual fee sub

## Plan (3 steps)

### Step 1: Fix her database record
Clear `stripe_subscription_id` and `subscription_status` so they stop falsely showing an active dues subscription. Keep `annual_fee_subscription_id` as-is (that's correct).

```sql
UPDATE members 
SET stripe_subscription_id = NULL, 
    subscription_status = NULL
WHERE id = '77150c1b-e358-4db0-9110-97078d1c59df';
```

### Step 2: Charge March dues via one-time invoice
Create a Stripe invoice for $250 + processing fee (2.9% + $0.30) for March dues, using:
- `stripe--create_invoice` for customer `cus_TtOsmHEP7aEKZw`
- `stripe--create_invoice_item` with Gold monthly price `price_1Sl9pvLyZrsSqLhsIWyf2WwX`
- `stripe--finalize_invoice` to send/charge it

This charges her saved card immediately for the missed March payment.

### Step 3: Create new monthly subscription starting April 9th
Use the existing admin "Create Subscription" feature (the `useAdminCreateSubscription` hook calls the `stripe-payment` edge function with `admin_create_member_subscription` action). This will:
- Create a new Stripe subscription for Gold monthly ($250/mo + processing fee)
- Set `billing_cycle_anchor` to April 9th so it charges on the 9th each month
- Update her `stripe_subscription_id` and `subscription_status` in the database

### Step 4: Void the orphaned open invoice
The old open invoice (`in_1T8xIC...`) from the canceled subscription needs to be voided so she's not double-charged.

### Summary
- March: One-time invoice charge of ~$257.55 ($250 + fees)
- April 9th onward: New recurring subscription, $250/mo + fees, auto-billing on the 9th

