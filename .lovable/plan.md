

# Show Next Billing Dates in Admin Portal (No More Stripe Dashboard)

## What's Already Working

Good news: next billing dates **are already visible** on each member's detail page. When you go to a member's profile and click the **Billing & Payments** tab, the "Billing Health" card shows "Next billing" pulled live from Stripe. So you don't need to go to Stripe for individual members.

The billing realignment after a freeze is also already wired up (we just added it). When a freeze ends — either manually or automatically — the system calls `update_billing_anchor` which uses Stripe's `trial_end` to shift the next charge date. This permanently resets the billing cycle anniversary, so all future months follow from the new date.

## What's Missing

There's no **at-a-glance view** showing all members' upcoming billing dates on the main admin pages. You have to click into each member individually. You also have the Autopay Schedule report under Payment Tracking, but it may not be obvious.

## Proposed Changes

### 1. Add "Next Billing Date" column to the main Members table
In the admin Members list (`AdminMembersTable.tsx`), add a column showing each member's next billing date. This will batch-fetch dates from the existing `get-autopay-dates` edge function (which already retrieves `current_period_end` from Stripe in bulk) so you can see everyone's next charge date without clicking into each profile.

### 2. Add next billing date to the SubscriptionCard on member detail
The `SubscriptionCard` component (visible on the Overview tab) currently shows subscription status and a Stripe link but **not** the next billing date. Add the next billing date here using the `billingHealth.duesSubscription.currentPeriodEnd` data that's already being fetched, so you can see it without switching to the Billing tab.

### Files to modify
- `src/components/admin/AdminMembersTable.tsx` — add "Next Billing" column, batch-fetch dates via `get-autopay-dates`
- `src/components/admin/SubscriptionCard.tsx` — display `currentPeriodEnd` from billingHealth prop (already available, just not rendered)

No new edge functions or database changes needed. Both data sources already exist.

