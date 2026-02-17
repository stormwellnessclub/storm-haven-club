

## Fix: Spa Appointment Booking with Credits

### Problem
When staff try to book a wellness session for a member using credits from the Member Detail page, the insert fails with:
> Could not find the 'credit_id' column of 'spa_appointments' in the schema cache

The code on line 2112 of `MemberDetail.tsx` passes three fields that do not exist in the `spa_appointments` table:
- `credit_id` (does not exist)
- `credit_type` (does not exist)
- `notes` (does not exist -- the table has `staff_notes` and `member_notes`)

### Solution

Two options:

**Option A -- Add missing columns (recommended)**
Add `credit_id` and `credit_type` columns to the `spa_appointments` table so we can track which credit was used. Fix `notes` to use `staff_notes` instead.

- Migration: `ALTER TABLE spa_appointments ADD COLUMN credit_id uuid REFERENCES member_credits(id), ADD COLUMN credit_type text;`
- Code fix in `MemberDetail.tsx` line 2112: change `notes` to `staff_notes`
- Run `NOTIFY pgrst, 'reload schema';` so the API recognizes the new columns immediately

**Option B -- Remove the fields from the insert**
Simply remove `credit_id` and `credit_type` from the insert and change `notes` to `staff_notes`. The credit deduction already happens on line 2104, so the booking would still work -- we just wouldn't track which credit record was used on the appointment itself.

### Recommendation
Option A is better for audit/tracking. It lets staff see which credit was consumed for each appointment.

### Technical details

**Database migration:**
```sql
ALTER TABLE public.spa_appointments
  ADD COLUMN credit_id uuid REFERENCES public.member_credits(id),
  ADD COLUMN credit_type text;

NOTIFY pgrst, 'reload schema';
```

**Code change in `src/pages/admin/MemberDetail.tsx` (line ~2112):**
Change `notes: "Booked by staff"` to `staff_notes: "Booked by staff"`.

The `credit_id` and `credit_type` fields already in the insert will then work once the columns exist.

**Files changed:** `src/pages/admin/MemberDetail.tsx` (1 line fix)
