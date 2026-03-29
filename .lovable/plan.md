

# Add Class Check-In to Front Desk Kiosk

## Problem
The Today's Classes section is read-only — it shows class names and enrollment counts but staff can't click into a class to see its roster or check attendees in. The only way to check in a class booking is via the general search, which requires knowing the person's name.

## Solution
Make the Today's Classes card interactive: clicking a class row expands it to show the roster of confirmed bookings with a one-tap "Check In" button per attendee.

## Steps

### 1. Create a new `KioskClassRoster` component
- When a class session row is clicked, fetch its bookings via a new kiosk-safe RPC (`kiosk_class_roster`)
- Display each attendee with name, check-in status, and a "Check In" button
- Use the existing `kiosk_check_in_class` RPC to process the check-in
- After check-in, refresh the roster and attendance feed

### 2. Create `kiosk_class_roster` database RPC
A SECURITY DEFINER function granted to `anon` that returns today's bookings for a given session:
```sql
CREATE OR REPLACE FUNCTION kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
```
Returns: `booking_id`, `name` (member name or walk-in name), `status`, `checked_in_at`, `photo_url`

### 3. Update `TodaysClasses` in FrontDesk.tsx
- Make each class row clickable — clicking toggles the inline roster
- Show the `KioskClassRoster` component below the selected row
- Add visual indicator (chevron, highlight) for the expanded class

### 4. Wire up check-in
- Reuse existing `useKioskCheckIn.checkInClass()` hook
- On successful check-in, invalidate the roster query and call `refetch()` on attendance

## Result
Staff can tap a class → see all attendees → tap "Check In" next to each name, all without leaving the front desk kiosk.

