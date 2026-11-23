# Linda Hakim: hold Nov 24 card payment (paying cash)

## What happens
1. **Stop tomorrow's $800 card charge.** Her Amex will not be charged on Nov 24. The Dec 24 and Jan 24 card payments stay scheduled as normal.
2. **Mark the Nov 24 payment "On hold – paying cash"** so staff can see it's expected at the desk, not missed.
3. **Fix the Oct 24 record.** It's showing unpaid because the card charge was refunded. It will show as **paid in cash**, so her plan reads correctly.
4. **When she brings the cash,** staff record it the usual way. The payment then shows as paid and her sessions for that payment are released.

Nothing is charged, refunded or sent to her.

## Technical details
- Stripe subscription `sub_1UU7MqLyZrsSqLhsqXTYee4x` (from schedule `sub_sched_1UPI1KLyZrsSqLhseGdDLgkP`): set `pause_collection` = `{behavior: void, resumes_at: Nov 25 Detroit}`, so only the Nov 24 invoice is voided. Confirm afterwards that the upcoming invoice shows Dec 24.
- `pt_payment_plan_installments` for user b8deeb2d…, sale intent 74f03649…:
  - #1 (Oct 24): status `paid`, `paid_via` `cash`, using the existing cash-recording path so sessions are released once (check that they haven't already been released).
  - #2 (Nov 24): set to a held/awaiting-cash status that the billing jobs skip, with a note.
- Read back both rows and the Stripe subscription to verify.
