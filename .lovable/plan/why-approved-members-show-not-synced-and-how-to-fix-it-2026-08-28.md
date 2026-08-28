# Why approved members show "Not Synced" — and how to fix it

## What the badge means

In the Members tab, "Not Synced" is a warning badge that appears when a member has a Stripe customer record on file but no locally saved card details (brand / last 4 / expiration). It does not mean the member has no card — it means the club database hasn't copied the card info down from Stripe yet, so the Members list can't show "Visa •••• 1234" or run card-expiration checks for them.

## Why it happens right after approval

Verified in the database:

- Every recent membership application has a Stripe customer saved, but the application's card brand / last 4 / expiration fields are empty.
- When an application is approved, the new member record copies the card fields straight from the application — so it inherits blank card details while still receiving the Stripe customer ID.
- That combination (customer yes, card details no) is exactly what triggers "Not Synced".
- Recently approved members (e.g. the two created today) do eventually show real card data, because a later Stripe sync backfills it. So the badge is a temporary display gap, not a missing card — but it looks alarming and can persist until a sync runs.

## Proposed fix

1. Store card details on the application at the moment the applicant's card is saved, so the application row carries brand / last 4 / expiration alongside the Stripe customer ID.
2. On approval, if the application still has no card details but does have a Stripe customer, pull the customer's default payment method from Stripe and save it onto the new member record in the same step.
3. Backfill existing members that currently show "Not Synced" but do have an active Stripe customer, so the badge clears for anyone whose card is genuinely on file.
4. Leave the badge logic itself unchanged — after the above, "Not Synced" only appears in the genuine edge case where Stripe has a customer with no attached card.

## Technical notes

- Badge source: `src/hooks/useMembersBillingIssues.ts` (`card_not_synced`, shown when `!card_last4 && stripe_customer_id`).
- Approval copy: `src/pages/admin/Applications.tsx` (member insert copies `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` from the application).
- Card capture paths to update: the Stripe setup-intent webhook and `reconcile-card-setup-attempts`, so the application row is written with the card metadata.
- Backfill runs as a one-off server-side pass over members with a Stripe customer and no card metadata; no schema change is needed.
