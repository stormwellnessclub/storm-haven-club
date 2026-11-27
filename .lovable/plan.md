# Keep hidden PT schedule times off the app and the public site

## What's wrong
When you add a trainer schedule in PT admin and turn off "Visible to public", the switch saves correctly. But the times clients can pick from ignore it.

- The trainer profile's weekly hours already skip hidden schedules.
- The "Request a session" open times (app and site) come from a different calculation that never checks the switch. It also never checks the switch on hidden one-off "extra" times.

## The fix
1. Client-facing open times only use schedules and extra times marked visible. That covers request times, the "is this time open" check and instant booking.
2. Staff still see and book every schedule, hidden ones included, in PT admin and staff booking.
3. A client can't get around it by sending a hidden time directly. The server check refuses it the same way.
4. Existing hidden schedules disappear from the app and site right away, with no re-saving needed.
5. Nothing else changes: no bookings, requests, charges or messages.

## Check
- A test that hides a trainer's schedule and confirms clients get no open times from it, while staff still can.
- Open the request page in the preview and confirm the hidden hours are gone.
- The live site needs publishing afterward.

## Technical details
- `pt_trainer_day_windows` ignores `pt_trainer_availability.is_public` and `pt_trainer_overrides.is_public` (kind 'extra'). It feeds both client functions (`pt_client_request_times(_all)`, `pt_client_slot_is_open`, `pt_client_slot_is_full`, `pt_available_slots`) and staff ones (`pt_check_slot(_core)`, `pt_trainer_readiness`).
- Add `pt_trainer_day_windows(p_instructor_id, p_date, p_public_only boolean default false)`. With true, filter recurring and extra rows to `is_public`. 'replace' exceptions stay as-is, since they're staff-entered day replacements. Pass true from the client-facing callers only. Staff callers keep the default false.
- One migration with `CREATE OR REPLACE` for the affected client functions. Extend `src/lib/ptSameDayDatabase.test.ts` with a hidden-window case.
- Add an AGENTS.md rule saying client availability must respect `is_public`.
