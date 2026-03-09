

# Projections & Upcoming Auto-Pays System

## Current State

You already have several pieces in place:

1. **Upcoming Payments Tab** (`UpcomingPaymentsTab.tsx`) — shows members with upcoming billing dates, card risk levels, and expected amounts. However, it uses **hardcoded tier pricing** (`soul: 300, spirit: 450, aura: 750`) that doesn't match the centralized pricing in `membershipPricing.ts` (`silver/gold/platinum/diamond` with gender-based pricing).

2. **Revenue Analytics page** (`RevenueAnalytics.tsx`) — has a 12-month cash flow projection chart based on current applications/members.

3. **Reports** — `next-month-projection`, `cash-flow-projection`, and `class-revenue-projection` reports already exist in the report system.

4. **Stripe Live tab** — shows open/uncollectible invoices from Stripe directly.

## What's Missing / Broken

1. **Pricing mismatch**: The Upcoming Payments hook uses `soul/spirit/aura` tiers with flat prices, but your real pricing is `silver/gold/platinum/diamond` with gender-based rates. Expected amounts are likely wrong or $0 for most members.

2. **No Stripe-based billing dates**: Next billing is calculated by looping `addMonths` from `membership_start_date`, but Stripe has the actual `current_period_end` — the real next charge date. These can drift apart.

3. **No projection summary dashboard**: The Upcoming Payments tab shows individual rows but lacks aggregated projection cards like "Expected collections this week / this month / next 3 months" with confidence levels.

4. **Founding members shown but have $0 auto-pays**: Founding members who paid annually don't have recurring Stripe charges, but they still appear in the upcoming payments list.

## Plan

### 1. Fix pricing in Upcoming Payments hook
Update `useUpcomingPayments` in `usePaymentTracking.ts` to use `extractTier()`, `normalizeGender()`, and `getMonthlyPrice()` from `membershipPricing.ts` instead of the hardcoded `soul/spirit/aura` map. Also exclude founding members (they have no monthly auto-pay) or show them with $0 clearly marked.

### 2. Add a "Projections" summary section to the Upcoming Payments tab
Add projection summary cards to `UpcomingPaymentsTab.tsx`:
- **This week**: sum of expected payments in next 7 days
- **This month**: sum in next 30 days
- **At-risk amount**: sum of payments where card is expiring/expired
- **Collection confidence**: percentage of payments with valid cards

*(The 7-day and 30-day cards already exist but will now show correct amounts after the pricing fix.)*

### 3. Create a new "Auto-Pay Projections" tab on the Payment Tracking page
Add a new tab to `PaymentTracking.tsx` called "Projections" that shows:
- **Monthly projection chart** (next 3-6 months): bar chart of expected auto-pay collections by month, using real member data and correct tier/gender pricing
- **Breakdown by tier**: how much revenue is expected from each tier
- **Risk breakdown**: how much is at risk due to card issues
- **Founding member renewal dates**: when annual founding memberships are up for renewal

This tab will use a new component `AutoPayProjectionsTab.tsx` that queries active members and projects forward.

### Files

- **Modify**: `src/hooks/usePaymentTracking.ts` — fix `useUpcomingPayments` to use centralized pricing, exclude/flag founding members
- **Modify**: `src/components/admin/UpcomingPaymentsTab.tsx` — update summary cards with collection confidence metric
- **Create**: `src/components/admin/AutoPayProjectionsTab.tsx` — new projections tab with monthly chart, tier breakdown, risk analysis
- **Modify**: `src/pages/admin/PaymentTracking.tsx` — add Projections tab

