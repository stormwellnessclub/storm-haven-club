

# Fix Non-Member Class Booking -- Both Admin and User Side

## Problems Identified

### 1. Admin Roster: PersonSearch silently fails for non-members
The `PersonSearch` component queries `non_member_profiles.full_name` -- but that column **does not exist**. The table has `first_name` and `last_name` as separate columns. This means searching by name for non-members returns nothing. The query also filters by `full_name` in the `.or()` clause, which silently produces zero results instead of erroring.

**File:** `src/components/admin/roster/PersonSearch.tsx` (line 46)

### 2. Admin Roster: PaymentMethodSelector doesn't show `pilates_cycling` pass label
The `getCategoryLabel` function in `PaymentMethodSelector` only handles `reformer`, `cycling`, and `aerobics` -- it doesn't show `pilates_cycling` properly. Non-members with Pilates/Cycling passes see the raw DB value instead of a friendly label.

**File:** `src/components/admin/roster/PaymentMethodSelector.tsx` (lines 101-108)

### 3. Non-member self-booking: `useTempClassBooking` uses hardcoded category filter
The `useTempClassBooking` hook filters valid passes with a hardcoded list `["reformer", "cycling", "pilates_cycling"]` but doesn't use the centralized `classCategories.ts` mapping. This works but is fragile.

### 4. Portal discoverability: No "Book a Class" shortcut from the Passes page
When non-members look at their passes in `/portal/passes`, they see a "Book a Class" button but may not easily connect their pass to available classes if the schedule page doesn't clearly show their credits.

---

## Plan

### Fix 1: Repair PersonSearch for non-members
Update the `non_member_profiles` query in `PersonSearch.tsx` to use `first_name` and `last_name` instead of the non-existent `full_name` column. Build the search filter using `.or()` on both name fields and email. Construct `name` from `first_name + last_name` in the results mapping.

### Fix 2: Use centralized category labels in PaymentMethodSelector
Replace the local `getCategoryLabel` function with the imported `getCategoryDisplayName` from `@/lib/classCategories.ts`. This ensures consistent labeling for all pass categories including `pilates_cycling`.

### Fix 3: Add admin "Book into Class" action from NonMemberDetail
On the Non-Member Detail page's "Passes & Bookings" tab, add a quick-action button "Book into a Class" that navigates admin staff to the schedule management page, making it faster to add non-members to classes from their profile.

---

## Technical Details

### Files to modify

**`src/components/admin/roster/PersonSearch.tsx`**
- Line 44-47: Change `non_member_profiles` select from `"user_id, full_name, email"` to `"user_id, first_name, last_name, email"`
- Line 46: Change `.or()` filter from `full_name` to `first_name` and `last_name`: `.or(\`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%\`)`
- Lines 84-96: Construct `name` from `nm.first_name` and `nm.last_name` instead of `nm.full_name`

**`src/components/admin/roster/PaymentMethodSelector.tsx`**
- Import `getCategoryDisplayName` from `@/lib/classCategories`
- Replace the local `getCategoryLabel` function (lines 101-108) with `getCategoryDisplayName`
- Update the pass dropdown label (line 143) to use the imported function

**`src/pages/admin/NonMemberDetail.tsx`**
- Add a "Book into Class" button on the Passes & Bookings tab that links to `/admin/classes` so staff can quickly navigate to add the non-member to a session via the roster

