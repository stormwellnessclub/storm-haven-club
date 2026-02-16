

## Fix Dashboard Data Display and Billing Health Interactivity

### Issues Identified

1. **Dashboard shows limited data** -- The Recent Check-Ins, Appointments, and Applications widgets each only show 5 items with no indication of how many more exist. The stat cards (totals) are accurate, but the detail lists feel incomplete.

2. **Billing Health items are not clickable** -- The "Failed Payments", "Missing Subscription", and "Expiring/Missing Cards" rows in the Billing Health widget are static text. Clicking them does nothing. They should navigate to the Members page with the appropriate filter applied.

3. **Expiring/Missing card detection** -- The "missing payment method" check requires both `card_last4` being empty AND `stripe_customer_id` being empty. Members who have a Stripe customer but whose card metadata was never synced locally won't appear. Additionally, separate counts for "Expiring Cards" vs "Missing Cards" would be clearer.

### Plan

**1. Dashboard Widgets -- Show More Data and Totals**

- Increase the Recent Check-Ins limit from 5 to 10
- Add a count indicator showing "Showing X of Y" when there are more items than displayed
- Add "View All" links that are more prominent when counts exceed the displayed limit

**2. Billing Health Widget -- Make Items Clickable**

Each billing issue row will become a clickable link that navigates to the Members page with the correct filter:

| Item | Link Target |
|------|-------------|
| Failed Payments | `/admin/members?issues=true` |
| Missing Subscription | `/admin/members?subscription=none` |
| Expiring/Missing Cards | `/admin/members?card=no` |

The rows will also be split into separate lines:
- "Missing Cards" (count) -- links to `/admin/members?card=no`
- "Expiring Cards" (count) -- links to `/admin/members?card=expiring`

**3. Fix Card Detection Logic**

- Update the "missing payment method" check to flag members with a `stripe_customer_id` but no `card_last4` (card metadata not synced) as a warning
- Add a new "expiring" card filter option to the Members page so the link from the widget works
- Split the combined "Expiring/Missing Cards" count into two separate items in the widget

### Technical Details

**Files to modify:**

- `src/components/admin/BillingHealthWidget.tsx` -- Make each issue row a clickable `Link` component, split expiring vs missing cards into separate rows
- `src/hooks/useMembersBillingIssues.ts` -- Update the missing payment method check to also flag members with `stripe_customer_id` but no `card_last4`; separate `expiringCards` and `expiredCards` counts
- `src/pages/admin/Dashboard.tsx` -- Increase check-in limit, add total count indicators
- `src/pages/admin/Members.tsx` -- Add support for `card=expiring` filter to enable the widget link to work

