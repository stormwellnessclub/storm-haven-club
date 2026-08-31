# Malak Bazzi — Single Executed Records Packet (PDF)

One combined PDF you can upload to Stripe as-is. No CSV or JSON in the packet — those stay on file as backup only.

## What the packet will contain

**Part 1 — Executed Membership Agreement**
The actual four/five-page membership agreement PDF the club uses, with an execution block stamped onto it drawn directly from her application row:

- Member name, email, phone, member number `STM-000165`
- Agreement accepted electronically: submission timestamp (Mar 14 2026) and approval timestamp (Mar 16 2026), both America/Detroit with UTC alongside
- Each acceptance field she checked, printed as accepted: one-year commitment, credit card authorization, payment information provided, authorization acknowledgment, submission confirmation, membership agreement signed
- Membership type (Gold), commitment term Mar 16 2026 – Mar 15 2027
- Card brand and last four, and the Stripe customer id the card was vaulted to
- A short execution certificate stating the agreement was accepted electronically and that no handwritten signature exists — stated plainly so nothing in the packet can be attacked as overstated

**Part 2 — System Records Report**
Formal report pages, letterhead-style, no raw file dumps:

- Application record: every field from her application row rendered as a labeled table, with the source table named
- Email trail: the timestamped system emails sent to her (application submitted, approval, activation setup, charge confirmations) as a readable table
- Billing history: her paid invoices and charges from Stripe, with the disputed August 16 2026 charge marked
- Attendance: her check-in history, with the August 16 2026 9:28 AM check-in highlighted as same-day as the disputed charge
- Cancellation status: no written notice, no cancellation request, subscription active and not scheduled to cancel
- A closing note on what the records are and are not: electronic acceptance record, no wet signature, no IP capture, liability waiver not signed

Output: `/mnt/documents/malak-bazzi-executed-records-packet.pdf`

## Raw files

The existing CSV and JSON exports stay in place, untouched, as backup if Stripe asks for underlying data. They are not part of the packet.

## Technical notes

- Read-only. Existing exports are re-read from the local files already pulled; no new writes to the database and nothing submitted to Stripe.
- Timestamps rendered America/Detroit with UTC shown.
- Execution stamp goes on its own page rather than over the agreement's signature lines, so nothing existing is obscured.
- Every page image-QA'd before delivery.
