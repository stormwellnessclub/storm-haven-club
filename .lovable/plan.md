

# Fix Kids Care: Pass Deduction, Profile Visibility, Parent Navigation, Room Capacity

## Issues Found

### Bug 1: Pass sessions never deducted (16/16 stays forever)
The member-facing booking flow (`useBookKidsCare`) creates the booking, then tries to UPDATE `class_passes` to deduct a credit. But there is **no RLS UPDATE policy for regular users** on `class_passes`. The only UPDATE-capable policy is "Staff can manage passes" which requires admin/manager roles. So the deduction silently fails every time a parent books through the member portal.

Aria has 3 bookings (1 checked_out, 2 confirmed) and Leila has 1 (checked_out) — all still showing 16/16.

The admin `admin_create_kids_care_booking` RPC runs as SECURITY DEFINER and does deduct, but most bookings are created through the member flow which hits the RLS wall.

**Fix**: Add an RLS policy allowing users to UPDATE their own passes (`user_id = auth.uid()`). Then run a data fix to reconcile the actual remaining credits for Aria's and Leila's passes based on active bookings.

### Bug 2: "No child profile registered" shows even when profile exists
The RPC's NULLIF strips "None" values from allergies, medical_conditions, and special_instructions (correct behavior — "None" means parent typed "None" meaning no issues). But the UI's "no profile" check at line 353 tests:
```
!child_allergies && !child_medical_conditions && !child_emergency_contact_name && !child_special_instructions
```
When all allergy/medical/instruction fields are legitimately empty/None, and emergency_contact_name IS filled, it should NOT show the warning. However, there are edge cases where the child name match could fail (trailing spaces, etc.) causing the LEFT JOIN to return NULLs for all child profile fields.

For Aria specifically, the data shows `emergency_contact_name = "Ali Koussan"` and `authorized_pickup_persons` is filled. The TRIM match should work. But the "no profile" check should also consider `child_authorized_pickup_persons` and `child_photo_release` — if ANY child profile field has data, the profile exists.

**Fix**: Change the "no profile" check to verify whether the child profile JOIN actually matched, not whether specific fields happen to be null. Add a `child_profile_found` boolean to the RPC return.

### Bug 3: Can't click on child/parent to navigate to their account
The booking cards show child name and parent name as plain text. There's no link or button to navigate to the parent's member profile or account.

**Fix**: Make the parent name a clickable link that navigates to `/admin/members/{member_id}` when member_id exists, or to the non-member accounts page when it's a non-member.

### Bug 4: Room capacity dashboard not counting checked-in children
The capacity dashboard filters by `["confirmed", "checked_in"]` which should work. But if pass data isn't loading correctly or bookings aren't properly attached to rooms, counts will be wrong.

After checking the data: both bookings have `status: checked_out` for today, and the capacity dashboard correctly only counts `confirmed` and `checked_in`. Since both children were already checked out when the user looked, they wouldn't show in capacity. This is actually correct behavior — but the user may have looked while they were still checked in. The real capacity issue is that the booking was likely created without proper room assignment from the member flow.

**Fix**: Ensure room is always assigned on booking creation. Also add `checked_out` children to the capacity view with a different visual indicator so staff can see total daily usage.

## Plan

### 1. Database migration: Add UPDATE RLS policy for users on class_passes
```sql
CREATE POLICY "Users can update their own passes"
  ON public.class_passes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 2. Data fix: Reconcile pass credits for existing bookings
Count all non-cancelled bookings per pass and set `classes_remaining = classes_total - count`.

### 3. Update RPC to return `child_profile_found` boolean
Add `(kc.id IS NOT NULL) AS child_profile_found` to the RPC return, so the UI can distinguish "no profile" from "profile exists but fields are empty."

### 4. Fix "no profile" check in Childcare.tsx
Replace the four-field check with `!booking.child_profile_found`.

### 5. Add parent navigation links on booking cards
Make the parent name clickable → `/admin/members/{member_id}`.

### 6. Show checked-out children in capacity dashboard
Add checked_out bookings with a muted visual so staff can see total daily usage alongside current capacity.

## Files to change
- New migration SQL: UPDATE policy on `class_passes` + data reconciliation + RPC update with `child_profile_found`
- `src/pages/admin/Childcare.tsx` — fix "no profile" check, add parent navigation link
- `src/hooks/useAdminKidsCareBookings.ts` — add `child_profile_found` to interface
- `src/components/admin/KidsCareCapacityDashboard.tsx` — show checked-out children as "used today"

