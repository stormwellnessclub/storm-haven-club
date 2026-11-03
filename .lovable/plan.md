# Extend membership commitments for freezes

## Result
Membership freezes will pause the commitment clock as well as billing. Staff will see the adjusted commitment date and time remaining in the member's details.

Deana Boussi started February 9, 2026 and was frozen August 1–October 2, 2026 (62 days). Her 12-month commitment therefore runs through April 12, 2027: 5 months and 9 days remaining as of November 3, 2026.

## Changes
- Calculate the original commitment date from the membership start date and the existing 12-month commitment.
- Extend it by actual frozen days, including completed historical freezes. Early-ended freezes count only the time actually frozen.
- Show the adjusted date, frozen days and remaining commitment in staff member details. For an ongoing freeze, clearly label the date as provisional and count elapsed frozen time only.
- Do not count pending, rejected or cancelled requests that never became active.
- Leave payments, annual fees, membership status and cancellation decisions unchanged. A commitment end date is not an automatic membership cancellation date.

## Technical approach
- Use one shared commitment calculation based on member start dates and authoritative freeze records, with overlapping freeze days counted once. Keep commitment dates separate from the existing optional membership end date.
- Recalculate on read rather than incrementing a stored end date, so repeated completion attempts cannot extend the term twice and historical freezes are included without rewriting member records.
- Reuse the calculation wherever remaining commitment is displayed, and refresh the member detail after a freeze changes.
- Add isolated tests for Deana's exact 62-day extension, early termination, overlapping freezes, ongoing freezes and excluded requests. No test will modify live clients, charge cards or send messages.

## Verification
Run the calculation tests and check the staff view against Deana's existing records without changing them.