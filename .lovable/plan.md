

## Show Child Profile Details in Admin Childcare Bookings

### Problem
When parents register their children for Kids Care, they fill out a detailed child profile in `kids_care_children` (allergies, medical conditions, medications, emergency contacts, authorized pickup persons, special instructions). But the admin booking cards don't show any of this — staff only see the child's name, age, and booking time. There's also no `child_id` foreign key linking bookings to child profiles, so the connection has to be made by matching `child_name` + `user_id`.

### Solution

#### 1. Update the backend function to include child profile data
Modify `get_admin_kids_care_bookings` to LEFT JOIN on `kids_care_children` matching by `user_id` and `full_name = child_name`. Return the critical fields:
- `allergies`
- `medical_conditions`
- `medications`
- `emergency_contact_name`
- `emergency_contact_phone`
- `relationship_to_child`
- `authorized_pickup_persons`
- `special_instructions` (from child profile, not just booking notes)
- `photo_release`

#### 2. Update the admin booking cards to display this info
In `src/pages/admin/Childcare.tsx`, expand each booking card to show:
- An "Important Info" section with allergies/medical/medications (highlighted if present)
- Emergency contact details
- Authorized pickup persons
- Photo release status

This info will be collapsible/expandable so cards aren't cluttered but staff can quickly access it.

#### 3. Update the hook types
Add the new child profile fields to the `AdminKidsCareBooking` interface in `src/hooks/useAdminKidsCareBookings.ts`.

### Files to modify
- Database migration — update `get_admin_kids_care_bookings` to join `kids_care_children`
- `src/hooks/useAdminKidsCareBookings.ts` — add child profile fields to types and mapping
- `src/pages/admin/Childcare.tsx` — render child profile info on booking cards

### Technical Details

**SQL join strategy** (no `child_id` FK exists):
```sql
LEFT JOIN kids_care_children kc 
  ON kc.user_id = b.user_id 
  AND kc.full_name = b.child_name 
  AND kc.is_active = true
```

**Card layout**: Each booking card will have an expandable section below the time slot showing allergies (red highlight if present), medical conditions, medications, emergency contact with phone, and authorized pickup list.

