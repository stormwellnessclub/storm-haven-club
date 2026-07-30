# Fix: guest pass check-ins show no date

## What's wrong

When a guest pass is sold in-house and the guest is checked in, the record shows "checked in" but with a blank date, and the visit doesn't reliably appear in today's attendance.

Verified causes:

1. **Two different "checked in" statuses.** The kiosk check-in function writes `status = 'used'`, sets `used_at = now()` and `valid_date = today`. The Front Desk guest pass page and the admin guest sheet instead write `status = 'exhausted'` with `used_at` only — they never set `valid_date`. Today's attendance list filters guests on `status = 'used'` AND `valid_date = today`, so a front-desk check-in fails both conditions.
2. **Rows with no check-in timestamp at all.** A database query returned guest passes marked `exhausted` with `used_at` NULL and `valid_date` NULL (for example the record created 2026-07-30 for Amanda Berry). Those rows render an empty date anywhere the date column is shown. I have not yet confirmed which code path produced them, so identifying that is a step of this work rather than an assumption.

## Plan

1. **Make every check-in path write the same fields.** Front Desk guest pass check-in and the admin guest detail check-in will both go through the existing `kiosk_check_in_guest` database function (or write the identical fields: `status`, `used_at = now()`, `valid_date = today`, `checked_in_by`) so no path can leave the date blank.
2. **Normalize the status.** Treat `used` and `exhausted` as the same "checked in" state everywhere it is read — today's attendance, the front desk lists, guest reports and follow-up queue — instead of matching one exact string.
3. **Display a safe date.** Wherever a check-in date is shown, fall back to `valid_date`, then the purchase date, and show a plain "date not recorded" label rather than an empty cell.
4. **Find and close the blank-record path.** Trace which flow creates a pass already marked exhausted with no timestamps (likely a sale flow or a status override), and make it either set the timestamps or leave the pass active.
5. **Backfill.** For the existing rows that are exhausted with a missing timestamp, set `valid_date` from the pass's purchase date where that is unambiguous; leave the rest untouched and visibly labeled rather than guessing a visit date.

## Technical notes

- Files: `src/pages/frontdesk/GuestPassesPage.tsx` (`markUsed`), `src/components/admin/GuestDetailSheet.tsx` (`handleCheckIn`), `src/pages/admin/GuestPasses.tsx`, `src/hooks/useUnifiedAttendance.ts`, `src/hooks/useKioskAttendance.ts`, `src/hooks/useUnifiedCheckInSearch.ts`.
- Timezone: dates are computed in `America/Detroit`, matching the club standard, not UTC.
- Any status/date backfill runs as a data update, not a schema migration.
