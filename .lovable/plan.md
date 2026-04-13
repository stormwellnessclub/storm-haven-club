

## Fix: Completed Appointments Locked Out of Checkout

**Problem**: Three conditions in `Appointments.tsx` restrict completed appointments from reopening checkout if `amount_paid` is already set. This prevents correcting charges, adding tips, or re-charging.

### Changes

**File 1: `src/pages/admin/Appointments.tsx`**

1. **Line 114** — `handleAppointmentClick`: Remove `&& (!appointment.amount_paid || appointment.amount_paid === 0)` from the completed branch.

2. **Lines 120-122** — `isClickable`: Simplify to `apt.status === 'completed'` without amount check.

3. **Lines 191-206** — Charge button: Remove `&& (!appointment.amount_paid || appointment.amount_paid === 0)` from the render condition. Make button label dynamic: show "Edit Payment" if `amount_paid > 0`, otherwise "Charge".

**File 2: `src/components/admin/spa/SpaCompletionDialog.tsx`**

4. **Pre-populate from existing data**: Initialize `paymentMethod`, `tipPreset`/`customTip`, and `staffNotes` state from the appointment's existing values when present (using lazy initializers or an effect keyed on `appointment.id`).

5. **Previous payment notice**: Add an amber info box at the top of the dialog body when `appointment.amount_paid > 0`, showing previously recorded amount, tip breakdown, and an "overwrite" warning.

6. **Dynamic title**: Replace the current title logic with:
   - `amount_paid > 0` → "Edit Payment"
   - `retroactive` → "Charge for Appointment"  
   - else → "Complete Appointment"

No changes to Stripe logic, tip math, totals, submit handler, or any other file.

