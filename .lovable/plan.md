

# Complete Spa Admin Booking & Conflict Prevention System

## Problem
Three gaps in the current spa admin experience:

1. **"New Appointment" button does nothing** — The admin Appointments page (`src/pages/admin/Appointments.tsx` line 120-123) has a "New Appointment" button but no click handler or booking modal
2. **No conflict detection** — Availability slots can overlap for the same therapist/room without warning, and bookings don't check against availability windows
3. **Booking flow doesn't deduct therapist availability** — When a therapist is booked for one service, they remain "available" for other services at the same time

## Plan

### Step 1: Build Admin Booking Modal
Create `src/components/admin/spa/AdminSpaBookingModal.tsx` — a staff-facing appointment form that lets admins:
- Select a member (searchable dropdown from members table)
- Pick a service, date, and time
- Auto-assign therapist and room based on availability
- Add staff notes
- Book without requiring payment (staff can mark payment method as "in-person" or "member account")

Wire it to the "New Appointment" button on the Appointments page.

### Step 2: Add conflict detection to availability slot creation
Update `SpaAvailabilityTab.tsx` — before saving a new/edited availability slot, query existing slots for the same `therapist_id` or `room_id` with overlapping `day_of_week` + time range. Show a warning dialog if conflicts are found, but still allow saving (since a therapist can offer multiple services in the same window — the real blocking happens at booking time).

### Step 3: Real-time therapist/room deduction at booking time
Update the booking conflict check in `useSpaBooking.ts` to:
- Cross-reference `spa_service_availability` to confirm the requested time falls within a defined availability window
- Check all existing `spa_appointments` (not just same-service) for the same therapist AND same room at the overlapping time
- When a therapist is booked for Service A at 10am, all other services with that therapist at 10am become unavailable

### Step 4: Bulk availability slot creation
Enhance the availability form to allow selecting multiple days at once (e.g., Mon through Fri) so admins don't have to create 5+ individual slots for the same therapist/service combo.

### Step 5: Therapist daily schedule view
Add a "Schedule" sub-view in the Availability tab showing a simple day grid per therapist — their assigned availability windows overlaid with actual bookings, making it easy to see at a glance who's free and who's booked.

## Technical Details
- **New file**: `src/components/admin/spa/AdminSpaBookingModal.tsx`
- **Modified files**: `src/pages/admin/Appointments.tsx`, `src/components/admin/spa/SpaAvailabilityTab.tsx`, `src/hooks/useSpaBooking.ts`
- **No database changes needed** — existing `spa_appointments`, `spa_service_availability`, `spa_therapists`, and `spa_rooms` tables already have the required columns
- Conflict detection queries use existing table relationships: `therapist_id` and `room_id` on both `spa_service_availability` and `spa_appointments`

