Re-pull Teresa's appointments and tips from the database for 6-25-26, then regenerate the 3-period pay PDF (v4) with the updated numbers.

Steps:
1. Query `spa_appointments` for staff_id `85fae30e-efae-4a3d-86dd-5101ba4bc25c` on 2026-06-25 to see the current appointments, tip amounts, payment methods, and customer names.
2. Compare against P3 (Jun 14 – Jun 28) in v3 and adjust:
   - Session count, hours, service pay
   - Prep/turnover (sessions × 0.25 hr × $26)
   - CC/Clover tips list for that date
   - Cash tips list for that date
3. Recompute P3 totals and grand total.
4. Regenerate PDF as `pay_summary-Teresa_Tyler_5-17-26_TO_6-28-26_v4.pdf` using the same 3-period layout and Storm brand colors.
5. Visual QA the PDF (pdftoppm → inspect) and confirm 6-25 changes are reflected.

No app code changes — this is a one-off document regeneration.