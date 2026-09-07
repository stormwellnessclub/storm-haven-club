# Teresa Tyler pay sheet — Aug 10 to Sep 7, 2026

A catch-up pay summary covering everything since her last pay period ended 8/9/26, broken down the same way as the 7/13–7/26 sheet: each session by service type, hours, tips by payment type, and turnover (sale value taken in).

## What the records show for this range

- 9 completed massages, 12 hours of service time, $181 in tips recorded
- 3 cancelled bookings (excluded from pay, listed separately so nothing looks missing)

## What you get

1. A printable PDF pay summary with:
   - Session log: date, time, client, service, length, how the sale was paid, tip, how the tip was paid
   - Breakdown by service type (Deep Relief, Lymph & Flow, Storm Signature) and by length (60 / 90 min): count, hours, rate, pay
   - Prep/turnover time: 15 minutes per completed session, shown as its own line with hours and pay
   - Tips grouped by payment type (card / cash / Clover / other), with cash tips listed but excluded from the payout since they were taken in hand
   - Turnover: total sale value taken in for her sessions, including add-ons, so you can see revenue against labor
   - Totals: service pay + prep pay + payable tips = amount owed
2. The same numbers laid out in chat so you can read them immediately.

## Notes on the numbers

- Hourly rate $26 (her rate on file). Say the word if it changed.
- Cancelled sessions are shown for reference only and are not paid.
- One 8/8 session was marked no-charge — that falls before this range, so it isn't included.
- Any session paid on a member account or marked "other" still counts toward her pay; turnover shows how it was collected.

## Technical detail

Read-only report generated from `spa_appointments` (staff_id = Teresa Tyler) for 2026-08-10 through 2026-09-07, using the same buckets and payout rules as `src/lib/spaPayrollPdf.ts` (`isPayoutTip` excludes cash, prep = 0.25 h per session). Output written to `/mnt/documents` as a PDF and visually checked page by page. No app code or data changes.
