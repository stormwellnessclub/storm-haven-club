Generate Teresa Tyler's pay summary PDF for the pay period **May 17, 2026 – June 28, 2026**, matching the format we've used before.

## Steps

1. Query `spa_appointments` for Teresa (staff_id `85fae30e-efae-4a3d-86dd-5101ba4bc25c`) between 2026-05-17 and 2026-06-28, pulling: date, time, service, duration, tip_amount, staff_notes/member_notes (to distinguish cash vs card/other tips), status.
2. Filter to completed appointments only. Compute:
   - Service hours per appointment (payable at $26/hr)
   - Turnover/prep: 15 min per completed session (payable, separate line item)
   - Credit card / "other" tips (included in payout)
   - Cash tips (already received, listed but excluded from total)
3. Build the PDF with `reportlab` in Storm brand colors (Smoked Umber `#1C170F`, Golden Dune `#F0DFC4`, cream `#DEDACE`, earth `#6C5D3E`, sand `#C1B19C`) — no blue. Sections:
   - Header (Teresa Tyler, pay period)
   - Service Appointments table (date, time, service name, minutes, rate, pay)
   - Turnover / Prep Time (count × 15 min × $26)
   - Credit Card / Other Tips (with dates + customers)
   - Cash Tips (informational, not in total)
   - Total To Pay summary
4. Save as `pay_summary-Teresa_Tyler_5-17-26_TO_6-28-26.pdf` to `/mnt/documents/` and give you the download link.

## Confirm before I run

- Hourly rate still **$26/hr**? (same as last time)
- Turnover still **15 min per completed session, paid**?
- Any completed appointments outside the standard flow I should include manually?