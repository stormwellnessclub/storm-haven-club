

# Charge for Completed Spa Appointments

## Problem
When marking a spa appointment as "Complete" (or adding a past appointment), there's no way to charge the member. The button just updates the status — no payment is collected, no Stripe link is created.

## Plan

### Step 1: Add a Completion + Charge Dialog
Create `src/components/admin/spa/SpaCompletionDialog.tsx` — when the admin clicks "Complete" on an appointment, instead of immediately updating the status, a dialog appears showing:
- Appointment details (service, member, price)
- Payment method selector: "Charge card on file", "Paid cash", "Paid other", "No charge"
- Optional tip amount (preset 15%/18%/20%/custom buttons)
- Staff notes field

If "Charge card on file" is selected, it calls the existing `stripe-payment` edge function with `action: "charge_saved_card"` using the member's Stripe customer ID, then records the `payment_intent_id` and `amount_paid` (service price + tip) on the appointment.

### Step 2: Add tip_amount column to spa_appointments
Database migration:
```sql
ALTER TABLE spa_appointments 
  ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;
```

### Step 3: Wire the dialog into the Appointments page
Replace the direct "Complete" button click in `src/pages/admin/Appointments.tsx` (lines 179-188) with opening the new `SpaCompletionDialog`, passing the appointment data. On successful charge + status update, refresh the appointments list.

### Step 4: Support retroactive charging for already-completed appointments
Add a "Charge" action button next to completed appointments that have `amount_paid = 0` or `NULL`, so you can go back and charge for appointments that were already marked complete without payment.

## Technical Details
- **New file**: `src/components/admin/spa/SpaCompletionDialog.tsx`
- **Migration**: Add `tip_amount` column
- **Modified**: `src/pages/admin/Appointments.tsx` (wire dialog, add retroactive charge button)
- **Modified**: `src/hooks/useAdminSpaAppointments.ts` (add mutation for updating payment info)
- Uses existing `stripe-payment` edge function with `charge_saved_card` action
- Member's Stripe customer ID is fetched from the `members` table via `member_id` on the appointment

