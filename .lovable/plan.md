

# Make Spa Appointments Clickable for Checkout/Charging

## Problem
Appointments show up in the Therapist Schedule view but are plain, non-interactive rows. You can't click them to complete or charge. The Appointments page (`/admin/appointments`) does have Complete/Charge buttons, but they're small and easy to miss.

## Plan

### Step 1: Add checkout interaction to Therapist Schedule
Update `src/components/admin/spa/SpaAvailabilityTab.tsx`:
- Import `SpaCompletionDialog` and add state for the selected appointment
- Make each booked appointment row clickable (cursor-pointer, hover effect)
- Add small "Complete" and "Charge" buttons on each appointment row (matching what the Appointments page already does)
- Wire clicks to open the `SpaCompletionDialog` with the correct appointment and retroactive flag

### Step 2: Improve Appointments page clickability
Update `src/pages/admin/Appointments.tsx`:
- Make the entire appointment row clickable (not just the small buttons) to open the completion dialog
- Keep the existing buttons but also allow clicking the row itself

### Result
Both screens — the Therapist Schedule and the Appointments page — will let you click any appointment to complete it and charge the customer using the existing payment dialog (card on file, cash, no charge, tips, etc.).

## Technical Details
- **Files modified**: `src/components/admin/spa/SpaAvailabilityTab.tsx`, `src/pages/admin/Appointments.tsx`
- **Reuses**: Existing `SpaCompletionDialog` component — no new payment logic needed
- **No migrations needed**

