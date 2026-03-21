
## Fix admin daycare bookings not showing

### What I confirmed
- The booking is in the backend already, so this is not a failed booking issue.
- I confirmed at least these confirmed bookings exist:
  - **Today:** Aria, 10:00 AM–12:00 PM
  - **Tomorrow:** Aria, 11:00 AM–1:00 PM
- So yes: at least one booking happened and was not visible in admin.

### Most likely root cause
The earlier timezone filter has already been removed in `src/pages/admin/Childcare.tsx`, so the remaining likely issue is the **admin fetch itself**:

- `useAdminKidsCareBookings` currently does:
  ```ts
  .select(`*, member:members(id, first_name, last_name, email)`)
  ```
- The childcare page is available to `childcare_staff`, but the `members` table does **not** currently grant that same role read access.
- If that joined query fails for a staff role, `Childcare.tsx` does not surface the error and instead shows an empty “No bookings found” state.

### Implementation plan

#### 1. Replace the fragile joined query with a safe backend-admin fetch
Create a backend function that returns kids care bookings plus only the parent fields the childcare screen actually needs:
- booking data from `kids_care_bookings`
- parent `first_name`, `last_name`, `email`
- only for approved staff roles (`super_admin`, `admin`, `manager`, `childcare_staff`, `front_desk`)

This avoids the current role mismatch and prevents the admin page from depending on direct `members` table access.

#### 2. Update the admin hook to use that backend function
In `src/hooks/useAdminKidsCareBookings.ts`:
- replace the current embedded `members(...)` select
- call the backend function instead
- preserve all existing filters:
  - date
  - date range
  - status
  - member
  - age group

#### 3. Show real errors instead of a fake empty state
In `src/pages/admin/Childcare.tsx`:
- read the query error state from `useAdminKidsCareBookings`
- show an error alert/banner if the admin fetch fails
- only show “No bookings found” when the query succeeded and returned zero rows

This prevents staff from missing bookings silently.

#### 4. Keep the timezone-safe date behavior
Do not reintroduce any JS `new Date(booking.booking_date)` filtering.
Keep using the backend date filter only.

### Files to update
- `src/hooks/useAdminKidsCareBookings.ts`
- `src/pages/admin/Childcare.tsx`
- new backend migration/function for secure admin kids-care booking retrieval

### Technical details
Recommended backend shape:
- `get_admin_kids_care_bookings(...)`
- `SECURITY DEFINER`
- explicit staff role check inside the function
- returns only the fields needed by childcare admin UI

This is safer than broadly opening `members` table access to childcare staff, because it exposes only the limited parent data needed for bookings instead of full member records.

### Expected result after fix
- Admin daycare will show the existing Aria bookings correctly
- Childcare staff/admin/front desk won’t get silent empty states
- If the fetch ever breaks again, staff will see an error instead of missing a live booking
