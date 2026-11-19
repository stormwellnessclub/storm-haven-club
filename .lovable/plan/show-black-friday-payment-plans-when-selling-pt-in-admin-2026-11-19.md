# Show Black Friday payment plans when selling PT in admin

## What's wrong
All 8 Black Friday payment plans exist and are turned on. But the staff "Sell package" screen only lists a plan once it has a linked Stripe price, and 7 of the 8 don't have one yet (only Member 30 sessions does). So staff see "no payment plans" for the rest.

The plan-start step already creates that Stripe price automatically the first time a plan is used, so the screen's check is stricter than it needs to be.

## Fix
- In the staff Sell package screen, show every active plan for the chosen package, whether or not its Stripe price exists yet.
- Nothing else changes: same prices, fees, payment schedule, and Stripe labels. The 10- and 20-session Black Friday packages stay pay-in-full (no plans were set up for them).

## Check
- Open Sell package for a member and a non-member client, pick each Black Friday 30/40/60/80 package, and confirm its plan shows with the right payments. Nothing gets sold.
- Publish afterwards so the live site gets it.

## Technical details
- `src/components/admin/SellPTDialog.tsx`: remove `&& p.stripe_price_id` from the `packPlans` filter. `admin-create-pt-payment-plan` already creates and saves a missing base price (non-test mode).
- Package edit page's "Ready to sell: Not yet" label (`PTPackageEdit.tsx`) changes to reflect that plans without a price are still sellable.
