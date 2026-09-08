# Fix online spa booking

## What I found

Customers picking a time online are shown times that are actually already taken, and the booking is only rejected at the final confirm step.

The booking screen builds the list of open times by reading existing spa appointments for that day (`src/hooks/useSpaBooking.ts:549`). But the database only lets a customer see their *own* appointments — everyone else's are invisible to them. So the list comes back empty, every time in the therapist's working hours looks free, and when the customer taps Book the server-side conflict check refuses it with "This time slot is already booked" / "This treatment room is already booked."

With one massage therapist and a small number of rooms, most of the day is already committed, so this hits a lot of people — matching the calls you got. Only 2 self-serve spa bookings have come through the portal in the last week.

Two related things make it worse:
- Massage availability is only set for Thursday, Friday, Saturday and Sunday (plus a one-off Sept 13). On other days a customer sees no times at all with no clear explanation.
- If the booking is refused, the times on screen are not refreshed, so the customer just sees the same "free" time and tries again.

## The fix

1. Add a read-only lookup the app can call that returns only *busy blocks* for a date — start time, length, which therapist, which room. No names, no notes, no prices, nothing personal. Public/booking screens call this instead of reading the appointments table directly.
2. Point the booking screen at that lookup so taken times disappear from the picker before anyone selects one — same behaviour for members, non-members and the public spa page.
3. If a booking is still refused (two people booking the same second), show a plain message and immediately refresh the times so the customer can pick another one without reloading.
4. When a chosen day has no massage coverage at all, show the existing "next available" line prominently instead of an empty list.

## Verification

- Reproduce first: run through the public spa booking flow in a browser against a day that already has a massage on the books, and confirm today it offers the conflicting time and fails at confirm.
- After the fix: the conflicting time no longer appears; a genuinely open time books successfully; the test booking is removed afterwards.
- Confirm a signed-out visitor and a signed-in member both see the same open times.

## Technical notes

- New `SECURITY DEFINER` function `public.get_spa_busy_slots(p_date date)` returning `(appointment_time, duration_minutes, cleanup_minutes, staff_id, room_id)` for statuses `confirmed/pending/checked_in/in_progress`; `GRANT EXECUTE` to `anon` and `authenticated`. No change to any RLS policy on `spa_appointments`.
- `useSpaBookedSlots` (`src/hooks/useSpaBooking.ts:549`) switches from `.from("spa_appointments").select(...)` to `supabase.rpc("get_spa_busy_slots")`, keeping the same `BookedSlot[]` shape so `generateAvailableStartTimes` in `src/lib/spaAvailability.ts` is unchanged.
- In `src/components/booking/SpaBookingModal.tsx`, on a conflict error from `useSpaBookAppointment`, invalidate `["spa-booked-slots"]` and clear the selected time.
- No change to pricing, payment, waiver, intake, or admin booking paths.
