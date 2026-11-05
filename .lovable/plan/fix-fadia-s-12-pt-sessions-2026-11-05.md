# Fix Fadia's 12 PT sessions

## What's there now
- Sale tonight: 12 single semi-private sessions at $55 each, $680.03 charged to her card on file.
- Start date Oct 25, 2026 (kept as you set it). Expiry saved as **Nov 8, 2026**, only 2 weeks out.
- None of her sessions are linked to the new package:
  - Mon Nov 2: completed, shows **unpaid**
  - Wed Nov 4 (11:30 AM): completed, shows **unpaid**
  - Fri Nov 6: scheduled, shows **unpaid**
  - The cancelled Wed Nov 4 noon session is left alone.

## Changes
1. **Expiry:** set all 12 sessions to expire **Thu Dec 24, 2026**, which is 60 days from the Oct 25 start date.
2. **Nov 2 and Nov 4:** use 1 session each from the package and mark both as paid by package.
3. **Fri Nov 6:** hold 1 session for it and mark it as paid by package. If it's later cancelled by the club, the session goes back.
4. **Result:** 9 sessions left, all good through Dec 24. Every deduction gets a note: "Applied to new 12-session sale per staff."
5. No charges, refunds, emails or texts.

## Technical details
- Update `expires_at = '2026-12-24'` on the 12 `pt_passes` in sale intent `pass_ids`.
- For 3 of those passes: insert a `pt_session_usage` consume row (sessions 1→0), set the pass to `exhausted`/0 remaining, and set `pass_id`, `usage_id`, `package_deducted = true` and `payment_status = 'pass'` on the 3 appointments, using the existing PT deduction function where possible.
- Read back afterwards to confirm 9 remaining and that no appointment is unpaid.
