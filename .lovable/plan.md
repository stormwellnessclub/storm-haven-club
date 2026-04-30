## Problem

On the admin Appointments page, the day timeline is a fixed list of hourly rows (06:00 → 20:00). Each appointment is placed only in the row matching its start time. A 90-min massage booked at 10:00 (which actually runs until 11:30, plus 15 min cleanup → blocked until 11:45) appears only in the 10:00 row. The 11:00 row therefore looks empty, even though that hour is fully occupied. Same for the next-available logic — visually, 11:00 and 11:45 look identical to staff.

The booking modals (member and admin) already prevent double-booking via `generateAvailableStartTimes` + the `check_spa_appointment_conflict` RPC, so this is purely an admin-calendar display problem.

## Goal

On the admin Appointments timeline, every hour row that an in-progress appointment overlaps should clearly show that the room/therapist is occupied — not appear empty. Cleanup time should be visualized too.

## Changes

### 1. Compute occupancy per hour row (`src/pages/admin/Appointments.tsx`)

Replace the simple "group by start time" map with a richer model:

- For each non-cancelled appointment, compute `[startMin, endMin)` where `endMin = start + duration_minutes + cleanup_minutes`.
- For each hour row in `timeSlots`, derive two lists:
  - `startsHere`: appointments whose start time falls in `[hour, hour+60)` — rendered as full cards (current behavior).
  - `ongoingHere`: appointments that started in an earlier hour but are still running (or in cleanup) during this hour — rendered as a compact "busy" strip.

Cancelled and no-show appointments are excluded from `ongoingHere` so they don't visually block the room.

### 2. New compact "ongoing" strip in each row

For each entry in `ongoingHere`, render a slim, muted bar inside the slot row showing:

- Service name + customer name (truncated)
- Therapist initial / room name
- A label like "in progress · ends 11:30" or "cleanup · until 11:45"
  - "in progress" when current row's start ≤ `start + duration`
  - "cleanup" when current row's start is in the cleanup window
- Same status color as the original card but at lower opacity / dashed border, so it visually reads as "still busy, don't book here"

Clicking the strip opens the same appointment dialog as the full card.

### 3. Visual treatment of fully-occupied rows

If an hour row has no `startsHere` but has `ongoingHere` entries, do NOT render the "Available" placeholder. Instead, render only the ongoing strips so staff immediately see the row is busy.

### 4. Optional: span-aware time grid (15-min)

Keep the default rows hourly, but additionally add any appointment start time (e.g. 11:50) to `timeSlots` (already done today via `appointmentsBySlot` keys). Extend the same logic to add the appointment's `end + cleanup` boundary so the next bookable moment is visible as its own row when it falls off the hour (e.g. 11:45). This makes "next bookable" obvious to staff.

### 5. Edit modal — already correct

`SpaAppointmentEditModal` already passes `excludeAppointmentId`, and the booking RPC honors it, so rescheduling an appointment to its current slot works. No change needed there.

## Out of scope

- No change to booking conflict logic — the booking modals already block 11:00 correctly.
- No change to the database. This is a UI-only improvement on `src/pages/admin/Appointments.tsx`.
- No change to the member-facing portal.

## Files touched

- `src/pages/admin/Appointments.tsx` — occupancy computation + render ongoing strips + cleanup labels.

## Technical notes

- Time math uses minutes-since-midnight on `appointment_time` ("HH:mm:ss"), `duration_minutes`, and `cleanup_minutes` from `AdminSpaAppointment`.
- Hour rows are 60-min wide; an appointment overlaps a row if `apt.startMin < rowEnd && apt.endMin > rowStart`.
- The strip's "ends at" uses `start + duration` (service end), and "until" uses `start + duration + cleanup` (room free).
- All filtering excludes statuses `cancelled` and `no_show`.
