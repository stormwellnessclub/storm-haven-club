## Problem

In Front Desk mode, expanding a class shows the enrollment count but never loads the list of names — so staff can't check anyone in. Same expand-but-blank pattern appears for Kids Care.

## Root cause

The `kiosk_class_roster` RPC (migration `20260427064109`) filters with:

```sql
AND cb.status IN ('confirmed', 'checked_in', 'completed')
```

But the `booking_status` enum in the database only has `{confirmed, cancelled, no_show, completed}`. There is no `'checked_in'` value. Postgres throws:

```
invalid input value for enum booking_status: "checked_in"
```

The RPC errors out → `KioskClassRoster` falls back to "No bookings yet". Verified against the live DB — today's 10am Reformer Sculpt has 3 confirmed bookings that should be visible.

The actual class check-in flow uses `status = 'completed'` to mark a booking checked in (it tracks the actual check-in via `checked_in_at`), so the roster just needs to use the real enum values.

Kids Care uses a `text` status column (not the enum), so its RPC works as written. The blank Kids Care list staff are seeing is because there's only one booking today and it's already `checked_out`. Once the class fix lands and we verify, Kids Care behavior will be the expected one — but I'll also tighten the kiosk's UI so checked-out children stay clearly visible with a "Checked out" badge (already implemented) and not hidden.

## Fix

New migration that recreates `public.kiosk_class_roster(uuid)` with the valid filter:

```sql
AND cb.status IN ('confirmed', 'completed')
```

Everything else (joins to `members` for name + photo, status, `checked_in_at`, ordering) stays identical. Re-grant EXECUTE to `anon` and `authenticated`.

No frontend changes needed — `KioskClassRoster.tsx` and `useKioskCheckIn.ts` already work correctly; they were just never receiving rows.

## Verification after deploy

1. Open `/front-desk`, expand the 10am Reformer Sculpt class → 3 names should render with avatars and a "Check In" button each.
2. Tap Check In → name flips to a green "In" badge (status moves to `completed`, `checked_in_at` set).
3. Confirm Today's Kids Care still shows the existing checked-out booking.

## Files changed

- New migration: `supabase/migrations/<timestamp>_fix_kiosk_class_roster_enum.sql`
