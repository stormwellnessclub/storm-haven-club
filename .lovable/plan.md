# Fix "Booking not found" when removing attendees from a class

## What's happening

Eman Altairi's booking exists (confirmed for tomorrow's 11:00 Reformer Sculpt – Adv/Int Heated), but admin removal fails with "Booking not found". The same root cause was behind yesterday's Carly issue — that one was patched manually in the database, but the underlying bug remains.

## Root cause

The remove mutation in `src/pages/admin/ClassRoster.tsx` (line 212) fetches the booking with an embedded PostgREST join:

```
.select("id, ..., members(...), profiles:user_id(first_name, last_name, email)")
.single()
```

`class_bookings.user_id` is a foreign key to `auth.users`, NOT to `public.profiles`. PostgREST cannot reliably resolve the `profiles:user_id(...)` embed via that relationship, so the query returns an error. The catch-all `if (fetchErr || !booking) throw new Error("Booking not found")` then masks the real PostgREST error with a misleading message — and the actual cancellation never runs.

This explains why the booking is intact in the database every time someone reports the error.

## Fix

Replace the embedded join with two separate, simple lookups:

1. Fetch the booking with plain columns only (no embedded relations).
2. After confirming the booking exists, fetch member info from `members` (by `member_id`) and profile info from `profiles` (by `user_id`) in two small follow-up queries.
3. Surface the real PostgREST error message in the toast if the booking fetch genuinely fails, instead of always saying "Booking not found".

The downstream cancellation logic, credit/pass refund, waitlist cleanup, enrollment recount, and email send all keep working unchanged — they just consume the separately-fetched `member` and `profile` variables.

## Files to change

- **`src/pages/admin/ClassRoster.tsx`** — refactor the `removeMutation` fetch step (lines ~212–217 and ~292–293).

## Manual cleanup

After the code fix deploys, I'll cancel Eman's stuck booking (`155ba434-9cc8-48bb-9366-8d2866f0af2c`) directly in the database and recompute the session's `current_enrollment`, the same way we cleared Carly's yesterday — so you don't have to retry from the UI.
