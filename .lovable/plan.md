# Black Friday PT payment plans

## What we're adding
8 preset monthly payment plans for the Black Friday Semi-Private packages (30, 40, 60, 80 sessions). Clients can pick one on the Black Friday page, and staff can sell one from the regular PT sale screen.

| Package | Member | Non-member |
|---|---|---|
| 30 sessions | 3 x $520 ($1,560) | 3 x $580 ($1,740) |
| 40 sessions | 4 x $470 ($1,880) | 4 x $530 ($2,120) |
| 60 sessions | 5 x $564 ($2,820) | 5 x $630 ($3,150) |
| 80 sessions | 7 x $480 ($3,360) | 6 x $542.86 + 1 x $542.84 ($3,800) |

- First payment at checkout, the rest monthly on the same day, charged to the saved card.
- No interest and no extra plan fee. Totals match the package prices.
- Plans stop on their own after the final payment.
- Plans can only be bought while the sale runs (ends Mon Nov 30, 11:59 PM). Payments already scheduled keep going after the sale ends.

## Sessions released as each payment goes through
- 30: 10 per payment
- 40: 10 per payment
- 60: 12 per payment
- 80: 12, 12, 12, 11, 11, 11, 11

If a payment fails, no new sessions are added until it's paid. Sessions the client already received stay usable.

## Use-by date stays separate
The package's use-by date (for example 279 days for 80 sessions) starts on the purchase date and is never set by the payment months. The 7-month plan finishes well before the 80-pack's use-by date.

## What the client sees
- On the Black Friday page, each package from 30 sessions up has two buttons: **Pay in full** and **Payment plan**.
- Before confirming, a summary shows the total price, the amount due today, every payment date and amount, how many sessions each payment adds, and this note: "Remaining payments are charged automatically to your card on file each month until the plan is complete."
- On their Personal Training page: sessions available now, sessions still to come, payments made, the next payment date and amount, and the full schedule.

## What staff see
- The 8 plans appear as choices in the regular PT sale screen, so staff can sell them in the club too.
- The client's PT billing shows each payment as paid, upcoming or failed, using the screens you already have. Failed payments follow the same follow-up you use today.

## Technical details
- Add 8 plan rows for the 12 existing Black Friday packages (30/40/60/80, member and non-member), using the current plan builder and its Stripe schedule with an exact last payment.
- New per-plan session release list. A new database rule adds sessions to the package only when each installment is marked paid, and never twice for the same payment.
- Packages on these plans start with only the first payment's sessions. Existing plans keep releasing all sessions up front.
- `pt-promo-checkout` gets a plan mode that reuses the server checks (correct price group, sale window, saved card) and starts the plan through the same path staff sales use. It keeps the repeat-tap protection, and a charge that fails to set up gets refunded.
- `pt_my_portal()` adds released/pending sessions and the payment schedule, without staff notes.
- Tests: each plan total, the session release counts (including 12,12,12,11,11,11,11), no release on a failed payment, no double release, and a use-by date that doesn't depend on the plan length.
- Nothing is sold or charged while testing.
