# Fix guest check-in failure

## Verified cause

Today’s guest pass is present, active, and valid for August 15. The live check-in function attempts to change it to `status = 'used'`, but the database constraint only permits `active`, `exhausted`, or `expired`. The backend log confirms the resulting constraint violation, so the pass remains active and Front Desk receives a failed check-in.

## Changes

1. **Repair the check-in function.** Update the staff-protected guest check-in function to use the existing canonical completed status, `exhausted`, while recording `used_at`, Detroit’s current date in `valid_date`, and the authenticated staff user in `checked_in_by`.
2. **Align every frontend fallback.** Change the shared guest check-in helper so its direct-update fallback writes `exhausted` rather than the invalid `used` value, preserving the same timestamps and staff attribution.
3. **Keep attendance and history accurate.** Update remaining guest attendance/history readers that require only `used` so checked-in `exhausted` passes appear immediately and in historical reports. Readers that already support both statuses will remain compatible with legacy data.
4. **Improve failure visibility.** Preserve the backend’s specific error message in the Front Desk check-in toast so a future data-rule failure is actionable rather than appearing as a generic failure.

## Verification

- Confirm an authenticated `front_desk` account can find today’s active guest and check them in.
- Confirm the pass becomes `exhausted` with `used_at`, `valid_date`, and `checked_in_by` populated.
- Confirm the guest appears in today’s attendance and check-in history and cannot be checked in twice.
- Confirm member, class, spa, and kiosk check-ins are unchanged.

## Technical notes

- This requires a small database-function migration plus focused frontend updates.
- Access remains staff-only through the existing authenticated role guard; no anonymous permissions will be added.
- Club dates remain calculated in `America/Detroit`.