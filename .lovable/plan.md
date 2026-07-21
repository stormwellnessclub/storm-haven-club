## Problem

After a member cancels, admin still can't "Hold" the freed seat. The Roster header shows the class as full even though a spot opened up.

## Root cause

In `src/pages/admin/ClassRoster.tsx`, seat math uses the full `bookings.length`, which includes cancelled and no-show rows (they're kept in the list so admin can see history, greyed out). So:

- Line 1201: `remaining = session.max_capacity - bookings.length` → cancelled rows are counted as occupying seats.
- Line 324 (inside `holdSlotsMutation`): same formula → the mutation throws `"Only 0 seats remain"`.

Meanwhile the auto-heal at line 231 already computes the correct active count: `attendees.filter(a => !a.isNoShow && !a.isCancelled).length`.

## Fix

Compute an `activeBookingsCount` once from `bookings` (excluding `isCancelled` and `isNoShow`) and use it wherever "seats taken" is needed:

1. `holdSlotsMutation` remaining check (line 324) → use `activeBookingsCount`.
2. Post-insert `current_enrollment` update (line 341) → `activeBookingsCount + count`.
3. Header "Hold seats" block (lines 1200–1215) → `remaining` uses `activeBookingsCount`; button's initial `holdCount` also uses it.

No schema, RPC, or backend changes. Cancellation flow already frees the seat in the DB (`cancel_class_booking`); this only corrects the admin UI's local math so the Hold action isn't gated by stale seat counts.

## Verification

- Open a session with a cancelled attendee and confirm the amber banner shows the correct remaining seats.
- Click "Hold seat" and confirm it inserts a hold row without the "Only 0 seats remain" error.
- Confirm `current_enrollment` matches the active (non-cancelled) count after holding.