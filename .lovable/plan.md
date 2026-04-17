

## Plan: Make spa double-booking visible in the UI (DB already enforces it)

### What's already working
- **Database (good)**: `check_spa_appointment_conflict` RPC blocks overlaps on **therapist** AND **room**, includes the **15-min cleanup buffer** (`duration + cleanup_minutes`), and `useSpaBookAppointment` calls it before insert. So a true double-booking cannot be saved.
- The 15-minute gap is enforced as cleanup time on every existing appointment, so a new appointment cannot start until 15 min after the previous one ends.

### What's broken (the UX problem)
The booking modals (`SpaBookingModal.tsx` for members, `AdminSpaBookingModal.tsx` for admins) generate the time-slot grid only from **availability windows** (Theresa 10–8). They do **not** subtract slots that overlap with existing appointments. So the user sees "11:00 AM" as available, picks it, and only gets the conflict error at submit.

### Fix

**1. Fetch existing appointments for the selected date + service**
- New hook `useSpaBookedSlots(serviceId, date)` that selects from `spa_appointments` where:
  - `appointment_date = date`
  - `status IN ('confirmed','pending','checked_in','in_progress')`
  - returns `appointment_time`, `duration_minutes`, `cleanup_minutes`, `staff_id`, `room_id`
- Auto-refetches when date or service changes.

**2. Filter slots in `generateAvailableStartTimes`**
Extend the helper in `src/lib/spaAvailability.ts` to accept booked appointments + the resource (therapist/room) the new booking would consume. Slot is removed if:
- `[slot_start, slot_start + duration + 15)` overlaps `[booked_start, booked_end + 15)` for the **same therapist** OR the **same room**
- This naturally enforces the 15-minute gap on both sides (cleanup is included in both intervals)

**3. Update both modals**
- `SpaBookingModal.tsx` (member): pass booked slots into the generator; conflicting times disappear from the grid
- `AdminSpaBookingModal.tsx` (admin): same, plus when admin manually picks a different therapist/room, regenerate the grid against that resource
- Add a small "X slots already booked" hint under the grid when applicable

**4. Live refetch after a successful booking**
Already invalidates `spa-appointments` query — extend to invalidate the new `spa-booked-slots` query.

### Files to change
- `src/lib/spaAvailability.ts` — add booked-slot filter param
- `src/hooks/useSpaBooking.ts` — add `useSpaBookedSlots` hook + invalidate after booking
- `src/components/booking/SpaBookingModal.tsx` — wire booked slots in
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — wire booked slots in, react to therapist/room change

### Result
- Booked time slots **disappear from the grid** before the user even clicks
- The 15-min gap is visible: a 10:00 AM 60-min appointment removes 10:00–11:15 AM from the grid
- Double-booking remains impossible at the database level as a final safeguard

