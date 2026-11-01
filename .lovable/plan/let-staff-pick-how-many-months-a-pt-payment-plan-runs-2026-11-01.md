# Let staff pick how many months a PT payment plan runs

## Why it's stuck at 7 months today
Each package only offers the payment plans saved on it. The 80 Pack has one saved plan, "7 Month Payment Plan" ($3,600: a first payment, then 6 monthly payments). When you sell it, you can only choose that plan or pay in full. You can already change the first payment, but not the number of months.

## What changes
In Sell PT Package, after you choose a payment plan, a new **Number of months** box appears:
- It starts at the plan's saved number (7 for the 80 Pack). You can raise or lower it, from 2 to 24 months.
- The total stays the same. The monthly amount is recalculated and the last payment covers any leftover cents.
- The payment preview updates right away, showing every date and amount before you confirm.
- It works together with the custom first payment you can already set.
- The saved 7-month plan isn't changed. Your change only applies to that one sale.
- The client's package, billing screen and receipts all show the real number of months.

Example: on the 80 Pack, $3,600 over 10 months is a first payment plus 9 monthly payments of about $360 each, with the card fee added the same way it is today.

## After this ships
1. You add Latife's package with the months you want.
2. I put her 13 booked sessions (Aug 13 to Oct 28) on that package, so they stop showing as unpaid.

## Technical details
- `SellPTDialog.tsx`: add a month-count input (default `selectedPlan.installment_count`), send it as `p_installment_count` to the preview, and as `installmentCount` to `admin-create-pt-payment-plan`.
- `pt_plan_schedule_preview_v2` and the plan-creation path accept an optional count override. They split the remaining balance (after the first payment) across count-1 future payments and reuse the existing custom-schedule path (per-sale Stripe price_data), so the template's Stripe price is left alone.
- The edge function checks the count is a whole number from 2 to 24 and stores the real count on the package (`future_installment_count`, `payment_plan_total_installments`).
- Add a unit test for the split: $3,600 over 10 months gives the expected installments and adds back up to the total.
- Testing uses preview only, with no live charge.
