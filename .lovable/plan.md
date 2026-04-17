

## Updated plan: full military time removal + Theresa availability + no-coverage UX

### Adding to the previously approved scope

**No-coverage day messaging (new requirement)**
When a member or admin selects a date with no therapist for the chosen service, instead of just greying it out or saying "No availability", the UI will:
- Show: **"No appointments available on [date]."**
- Show: **"Next available: [day], [date] at [time]"** as a clickable link/button
- Clicking it jumps the calendar + time input to that next available slot

This applies to both `SpaBookingModal.tsx` (member) and `AdminSpaBookingModal.tsx` (admin shows it as info, but admin can still override with manual therapist selection).

### Full plan recap

**1. Database**
- Migration: add `room_id` to `spa_appointments` + indexes + FK to `spa_rooms`
- Update `check_spa_appointment_conflict` RPC to block by staff OR room with cleanup buffer
- Seed `spa_service_availability` for Theresa: Thu/Fri/Sat (day_of_week 4, 5, 6), 10:00–20:00, all her active services, `is_active = true`

**2. Availability rules everywhere**
- End-time cap: `slot_start + duration + cleanup ≤ window_end` (so 90+15 min appt latest start = 6:15 PM for an 8 PM window)
- Server-side gate in `useSpaBookAppointment`: verify availability row exists before insert; auto-resolve and persist `staff_id` + `room_id`
- Reject overlapping bookings via conflict RPC

**3. No-coverage day UX (member + admin)**
- Calendar: dates with zero coverage greyed for members, selectable-with-warning for admins
- New helper: `findNextAvailableSlot(serviceId, fromDate)` — scans forward up to 60 days for the first day with active availability + open slot
- Empty state shows: "No appointments available on [date]. **Next available: Thursday, Apr 24 at 10:00 AM →**"
- Clicking the link sets the date and pre-fills the time

**4. Military time sweep — REMOVE EVERYWHERE**
Search project for all `HH:mm` rendering and replace with `formatTime12h()`:
- `time.slice(0, 5)` patterns
- `format(..., "HH:mm")` patterns
- raw `appointment_time` / `start_time` / `end_time` rendering
- `<input type="time">` → replace with text inputs using `parseTimeInput`

Files to audit:
- `src/components/admin/spa/SpaAvailabilityTab.tsx`
- `src/components/admin/spa/AdminSpaBookingModal.tsx`
- `src/components/booking/SpaBookingModal.tsx`
- `src/pages/admin/CheckIn.tsx`
- `src/pages/admin/Appointments.tsx`
- `src/pages/member/Wellness.tsx`
- `src/pages/member/Bookings.tsx`
- `src/pages/member/Dashboard.tsx`
- `src/pages/portal/Dashboard.tsx`
- Plus any other file flagged by the sweep

**5. Member visibility**
- New "Spa & Wellness" tab on `member/Bookings.tsx` (upcoming + past, with cancel)
- "Upcoming Spa Appointments" block on `member/Dashboard.tsx`
- Broaden `Wellness.tsx` filter to `service_category` instead of name substring
- Add upcoming spa block to `portal/Dashboard.tsx` for non-members

### Files to change
- DB migration (room_id + RPC + Theresa availability seed)
- `src/hooks/useSpaBooking.ts` (server gate, next-available helper, real conflict use)
- `src/components/booking/SpaBookingModal.tsx` (no-coverage UX, end-time cap, 12h)
- `src/components/admin/spa/AdminSpaBookingModal.tsx` (no-coverage warning, override, end-time cap, 12h)
- `src/components/admin/spa/SpaAvailabilityTab.tsx` (12h)
- `src/pages/admin/CheckIn.tsx` (12h)
- `src/pages/admin/Appointments.tsx` (12h verify)
- `src/pages/member/Bookings.tsx` (Spa tab + 12h)
- `src/pages/member/Dashboard.tsx` (upcoming spa block + 12h)
- `src/pages/member/Wellness.tsx` (broaden filter + 12h)
- `src/pages/portal/Dashboard.tsx` (upcoming spa + 12h)

### Expected result
- Every time anywhere reads as "10:00 AM" / "6:15 PM" — never military
- Theresa shows Thu/Fri/Sat 10 AM – 8 PM with last booking enforced
- Days with no coverage show **"No appointments available. Next available: [date] at [time] →"**
- Members see all spa appointments on Dashboard and Bookings
- Therapist + room double-booking blocked at the database level

