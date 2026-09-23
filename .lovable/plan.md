# Phase 2C.5B3 — Targeted Verification Run

Verification needs live sandbox activity (test-mode charges, a test clock, a disposable client, refunds, card changes). That changes system state, so it needs your approval before it runs. No real client, card, subscription, session balance, or appointment is touched.

## What the run will do

1. Build a fresh disposable sandbox client (clearly named ZZ TEST) with a test-mode card and a test clock.
2. Sell the 24-session package on the 4 x $900 plan and confirm the billing screen totals, sessions, next autopay, schedule, plan status and saved card all match the stored records.
3. Confirm the schedule table reads the stored installment rows from B2 — dates, amounts, paid/upcoming/failed, next and final payment — with no dates recalculated on the fly.
4. Advance the clock to collect a second payment, then check payment history: successful, manual, refunded, failed/recovered, invoices, and a package-settled session showing $0 collected with no duplicated revenue.
5. Force a declined payment, confirm it appears both on the client account and in the global Failed & Past Due list as the same obligation, retry it successfully, and confirm a second retry is blocked.
6. Add a second test card, move future autopays to it, and confirm past payments keep their original card.
7. Issue a partial refund on the disposable sale, confirm it shows identically in both places and does not change the session balance, then make a separate session adjustment through the existing ledger.
8. Sell a second disposable package to the same test client and confirm balances, plans, installments and stored terms stay separate.
9. Attempt retry, card change, refund, reschedule and balance adjustment as a trainer-level account and confirm each is refused by the server, and confirm one client cannot read another's PT financial records.
10. Confirm the same records appear from the client billing screen, /admin/pt/billing and the wider financial history with no copied rows.
11. Re-check production counts (13 packages, 6 passes, 106 appointments, no real payment plan records) before and after, then delete all sandbox data and the test clock.

## Known items to resolve during the run

- One earlier fix (failed payments now recording for clients who are not members) has not yet been confirmed end to end — step 5 confirms it.
- A leftover sandbox package and test client from the previous session get cleaned up.

## Technical notes

- Stripe test-mode keys and test clocks only; the live key is never used for this run.
- Driver scripts live under /tmp; no production rows are written.
- Any defect found is fixed narrowly and retested — no redesign, no Phase 2D work.

## Output

A short pass/fail report for the 10 areas, a list of defects, fixes and genuine limitations, and a single closing status line.
