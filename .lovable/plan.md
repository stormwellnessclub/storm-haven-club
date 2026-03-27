

# Fix: Show Amount Owed Prominently + Review Failed Payment Email

## What's actually happening now

1. **Amount owed IS tracked** — the ArrearsCard component exists and shows total debt with period-by-period breakdown, but it's hidden on the **Membership tab**. The default tab is "Profile", so when you open a member like Shireen, you never see it unless you click over to Membership.

2. **Failed payment emails ARE being sent** — when Stripe reports `invoice.payment_failed`, the webhook already sends:
   - A **member-facing email** ("Payment Issue") with the amount, failure reason, next retry date, and a button to update their payment method
   - An **admin alert email** to hello@stormwellnessclub.com with