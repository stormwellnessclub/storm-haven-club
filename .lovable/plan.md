

## Fix: Spa Appointments Not Visible in Admin Views

### Root Cause

The `useAdminSpaAppointments` hook — used by **all three** admin views (Appointments page, Therapist Schedule, Dashboard) — joins `staff:spa_therapists(id, full_name)`. But there is **no foreign key** from `spa_appointments.staff_id` to `spa_therapists.id`. Without that FK, PostgREST cannot resolve the relationship and the entire query fails with an error, returning zero results.

Additionally, the Dashboard appointment cards are rendered as plain `<div>` elements with no click handler — they display data but are not interactive.

### Verified Data

- There **are** appointments in the database for April 15, 16, and 17 (confirmed status, with member_id and user_id populated).
- RLS policies are correct — staff roles have full access.
- The query simply fails before RLS even matters because PostgREST rejects the unknown join relationship.

### Plan

**1. Add FK from `spa_appointments.staff_id` to `spa_therapists.id` (database migration)**

```sql
ALTER TABLE public.spa_appointments
  ADD CONSTRAINT spa_appointments_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.spa_therapists(id)
  ON DELETE SET NULL;
```

This single change fixes all three admin views simultaneously because they all flow through the same `useAdminSpaAppointments` hook.

**2. Change Dashboard `members!inner` join to left join**

The Dashboard query at line 171 uses `members!inner(...)`, which excludes any appointment where `member_id` is null. Change to `members(...)` (left join) so guest/unlinked appointments still appear.

**3. Make Dashboard appointment cards clickable**

Add an `onClick` handler to each appointment card in the Dashboard that navigates to `/admin/appointments` (or opens the completion dialog). At minimum, make them link to the Appointments page for that date.

### Files to change
- Database migration (add FK constraint)
- `src/pages/admin/Dashboard.tsx` — fix join type, add click handler to appointment cards

### Expected result
- All admin appointment views show the correct data for any date.
- Dashboard appointment cards are clickable and navigate to the appointments page.
- No security or data changes — this is purely a relationship declaration and UI fix.

