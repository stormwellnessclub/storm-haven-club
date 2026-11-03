# Extend membership commitments for freezes

## Result
Membership freezes will pause the commitment clock as well as billing. Staff will see the adjusted commitment date and time remaining in the member's details.

Deana Boussi started February 9, 2026 and was frozen August 1–October 2, 2026 (62 days). Her 12-month commitment therefore runs through April 12, 2027: 5 months and 9 days remaining as of November 3, 2026.

## Changes
- Calculate the original commitment date from the membership start date and the existing 12-month commitment.
- Extend it by actual frozen days, including completed historical freezes. Early-ended freezes count only the time actually frozen.
- Show the adjusted date, frozen days and remaining commitment in staff member details. For an ongoing freeze, clearly label the date as provisional and count elapsed frozen time only.
- Do not count pending, rejected or cancelled requests that never became active.
- A commitment end date is not an automatic membership cancellation date; keep annual fees and cancellation decisions unchanged.
- Scheduled and early freeze endings will share one verified billing restart: collect a full dues period without proration, reset the monthly billing day, and complete the freeze only after Stripe confirms.
- Prevent repeated billing-anchor resets on retries, use Detroit dates consistently, and never let the drift repair re-pause an ended freeze.
- Audit ended freezes and Ayana Silmi's November 4 restart using read-only live records; do not resume her early.

## Technical approach
- Use one shared commitment calculation based on member start dates and authoritative freeze records, with overlapping freeze days counted once. Keep commitment dates separate from the existing optional membership end date.
- Recalculate on read rather than incrementing a stored end date, so repeated completion attempts cannot extend the term twice and historical freezes are included without rewriting member records.
- Reuse the calculation wherever remaining commitment is displayed, and refresh the member detail after a freeze changes.
- Add isolated tests for Deana's exact 62-day extension, early termination, overlapping freezes, ongoing freezes and excluded requests. No test will modify live clients, charge cards or send messages.
- Share a durable Stripe freeze-operation marker and idempotency key across both restart paths, read the subscription back, and finish freeze/member updates atomically through a service-only function. Record failures for retries instead of silently completing a freeze.

## Verification
Run the calculation and billing-retry tests, verify the staff display where access permits, and confirm deployed expiration responses and scheduler results. Check live billing pauses and invoices read-only; no test charges or client notifications.