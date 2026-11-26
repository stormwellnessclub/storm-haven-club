# Seasonal Edit: show sold-out PT packs

## What changes
On the Seasonal Edit page, these personal training packs stay on the page with their price, but show a **Sold out** label and have no Buy or Payment plan buttons:

- **80 sessions**: sold out for members and non-members
- **10 sessions**: sold out for members and non-members
- **30 sessions**: sold out for non-members only (members can still buy it)

All other packs (20, 40, 60, and 30 for members) don't change.

## Safety
- If someone has the page open from before, or uses an old link, the checkout refuses a sold-out pack with "This package is sold out." No card is charged.
- Staff can still sell these packs in the club through the admin PT sale screen, so you can make exceptions.

## Technical details
- Add a `sold_out boolean default false` column to `pt_packs` with a migration. Return it from `pt_promo_packs`.
- Set it to true for the five Black Friday pack rows: member and non-member 80 and 10, plus non-member 30.
- `BlackFriday.tsx` `priceCell`: when the pack is sold out, show the price struck through with a "Sold out" label, and hide the buttons.
- `pt-promo-checkout`: reject the purchase when `sold_out` is true, including `checkOnly` requests. Redeploy the function.
- Live site needs publish afterward.
