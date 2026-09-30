# Close out PT admin foundation verification

You're right. The Stripe test-mode run was done on Sept 23 (Phase 2C.5B3). All 10 checks passed, including card changes: future payments moved to the new card, and paid payments kept their original card. I was wrong to say it was still open.

## What that run already covers
- Payment plans, AutoPay schedule, payment history with no duplicates
- Failed payment and retry, with double charges blocked
- Card changes and keeping PT cards separate from membership billing
- Refunds kept separate from session balances, multiple packages, staff-only permissions
- All test data removed afterward

## The one gap left
The Sept 23 run came before the new Sell PT search (same account for members and non-members, merged logins hidden). A completed sale through that new search hasn't been tested yet.

## Plan
1. Run one short test in the same Stripe test setup, using throwaway test people only:
   - Sell a package to a test **member** from their member account. Check it shows "Member · Personal Training Active" and that their membership card and billing don't change.
   - Sell a package to a test **non-member**. Check no membership is created.
   - Pick a different card for the PT sale. Check only that sale uses it.
2. Remove all test data and confirm real records match what they were before.
3. If everything passes, mark the PT admin foundation **VERIFIED**. Stop there. Phase 2D.2 still waits for your go-ahead.

No real clients, no live charges, no emails.

## Technical details
- Uses the `pt-sandbox-harness` function (test key only, refuses live keys), plus the SellPTDialog server path, pointed at test-mode customers.
- Before and after: counts of `pt_passes`, `pt_client_profiles`, `pt_payment_plans`, members' `default_payment_method`.
