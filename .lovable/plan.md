## Problem
On `/frontdesk`, check-ins succeed but the "Today's Attendance" panel stays empty ("No check-ins today yet"), even though the database has 18 check-ins for today (verified).

## Root cause (most likely)
`useKioskAttendance` calls the `kiosk_todays_attendance` RPC and, on any error, silently `console.error`s and leaves `entries` empty. The RPC is `SECURITY DEFINER` but only `EXECUTE`-granted to `authenticated`. On a shared kiosk device without a live Supabase session (or after the session expires), the RPC returns `permission denied` and the UI shows nothing — while individual check-in actions triggered by a staff member who *is* signed in still work.

Symptom fits exactly:
- DB has today's rows.
- RPC returns them when executed with proper privileges.
- Hook swallows errors → panel shows the empty state.

## Fix

1. **Broaden RPC access (DB migration).** The attendance panel only exposes what a walk-in already sees on the kiosk screen (first name, last name, membership type label, photo, check-in time). It is safe to grant `EXECUTE` to `anon` as well as `authenticated`:
   - `GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO anon, authenticated;`
   - Same grant applied to `kiosk_search_visitors`, `kiosk_check_in_*`, and `kiosk_class_roster` for parity, so the whole kiosk works on an unauthenticated device (matches how `/kiosk/reception` is intended to run per project memory).

2. **Surface errors in the UI (`src/hooks/useKioskAttendance.ts`).** Return `error` from the hook and, in `FrontDesk.tsx`, show a small inline warning inside the "Today's Attendance" card when it's non-null (e.g. "Couldn't load attendance — retry"). This prevents silent failures next time.

3. **Add a manual "Refresh" button** to the Today's Attendance card header so staff can force a refetch if realtime lags.

## Files touched
- `supabase/migrations/*_kiosk_grants.sql` — new migration adding the `anon` grants above.
- `src/hooks/useKioskAttendance.ts` — expose `error`, keep polling + realtime as-is.
- `src/pages/FrontDesk.tsx` — inline error banner + refresh button in the attendance card.

## Verification
- Reload `/frontdesk` on a fresh (signed-out) session → attendance list populates with today's 18 rows.
- Perform a new check-in → new row appears within ~1s via realtime; refresh button also works.
- Confirm no PII beyond what's already displayed on the kiosk is returned.
