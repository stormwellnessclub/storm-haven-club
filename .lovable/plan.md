

# Autopay Schedule Tab — Clear Billing Visibility

## Problem
Monthly dues subscriptions exist in Stripe but are hard to distinguish from annual fee subscriptions in the Stripe dashboard. Both show as flat list entries without clear labeling.

## Solution
Build an **Autopay Schedule** tab in Payment Tracking that pulls data from both the database and Stripe, clearly labeling each payment type (Monthly Dues vs Annual Fee vs Class Pass etc.).

## Implementation

### 1. New Edge Function Action: `get_autopay_schedule`
Add to `stripe-payment/index.ts` a new action that:
- Lists all active subscriptions from Stripe (paginated)
- For each subscription, identifies the type by matching price IDs against known membership/annual fee prices
- Returns upcoming invoice dates, amounts, customer info, and payment type labels
- Also queries `payment_attempts` table for historical success/failure data

### 2. New Hook: `src/hooks/useAutopaySchedule.ts`
- Calls the edge function with date range, search, and filter params
- Combines upcoming (from Stripe subscription data) and historical (from `payment_attempts` + `manual_charges`) into one sorted list
- Supports filtering by: date range, status (Success/Failed/Upcoming), payment type, search by name

### 3. New Component: `src/components/admin/AutopayScheduleTab.tsx`
- **Summary cards**: Total upcoming, success rate, total collected, failed count
- **Filters**: Date range picker, status dropdown, payment type dropdown, search box
- **Table columns**: Date | Client (clickable → member detail) | Payment Type | Tier | Card Info | Amount | Status
- **Status badges**: Green "Success", Red "Failed" (with decline reason), Blue "Upcoming"
- **Payment type labels**: "Monthly Dues", "Annual Fee", "Class Pass", "Manual Charge"

### 4. Modify: `src/pages/admin/PaymentTracking.tsx`
- Add 7th tab "Autopay" with Calendar icon
- Import and render `AutopayScheduleTab`

### Data Strategy
- **Upcoming payments**: Query `members` table for active members with `stripe_subscription_id`, use stored `current_period_end` or calculate from subscription metadata
- **Historical payments**: Query `payment_attempts` table joined with `members` for name/tier/card info
- **Payment type detection**: Match invoice line item price IDs against `STRIPE_PRODUCTS` constants to label as "Monthly Dues - Silver", "Annual Fee", etc.

### Key Feature: Payment Type Labeling
The core value — each row clearly shows whether it's:
- **Monthly Dues** (Silver $200 / Gold $250 / Platinum $350)
- **Annual Initiation Fee** ($300/yr)
- **Processing Fee** (auto-included)
- **Class Pass** purchase
- **Manual Charge**

This eliminates the confusion of the flat Stripe dashboard view.

