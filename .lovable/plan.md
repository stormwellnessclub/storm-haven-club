

# Fix Appointment Visibility and Charging

## Problem
Wafa's 10:00 AM massage appointment exists in the database but isn't showing on the Appointments page. Additionally, the therapist name (Teresa) doesn't appear because the query never joins staff data.

## Root Cause
The `useAdminSpaAppointments` hook (line 88) hardcodes `staff: null` instead of joining the `spa_staff` table. This means therapist names never display. The appointment data itself should be fetching correctly — I'll also verify nothing else is blocking display.

## Plan

### Step 1: Fix the staff join in useAdminSpaAppointments
Update the Supabase query in `src/hooks/useAdminSpaAppointments.ts` to join `spa_staff` via `staff_id`:
- Change the select to include `staff:spa_staff(id, full_name)`
- Remove the hardcoded `staff: null` on line 88 and use the actual joined data

### Step 2: Verify appointment rendering
Confirm the time slot matching logic works correctly for Wafa's `10:00:00` appointment time against the `10:00` slot. If needed, fix edge cases in the matching.

### Step 3: Confirm charging flow works
With the appointment visible, the existing "Complete" button will open the `SpaCompletionDialog` where you can charge Wafa's card, record cash, or add a tip. No changes needed to the dialog itself — just needs the appointment to be visible first.

## Technical Details
- **Modified file**: `src/hooks/useAdminSpaAppointments.ts` — add `spa_staff` join to the select query
- Single-file fix, no migrations needed

