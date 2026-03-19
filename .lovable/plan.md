

## Plan: Add Kids Care to Member Portal Nav + Admin Calendar View with Staff Names

### Issue 1: Kids Care Bookings missing from member sidebar

The route `/member/kids-care-bookings` exists and the page works, but there is no navigation link in the `MemberSidebar.tsx`. The page is unreachable unless you type the URL directly.

**Fix:** Add a "Kids Care" entry to the "Bookings & Visits" group in `src/components/member/MemberSidebar.tsx` with the `Baby` icon, pointing to `/member/kids-care-bookings`.

---

### Issue 2: Admin calendar view for Kids Care hours

Currently the admin editor shows a single-date picker and a list of slots. You want to see all configured dates at a glance in a calendar format.

**Changes:**

1. **Add `staff_name` column** to `kids_care_hour_slots` table via migration — a nullable text field for internal staff assignment.

2. **Update `KidsCareHoursEditor.tsx`** to:
   - Add a **monthly calendar overview** above or alongside the date picker. Dates with configured slots are visually highlighted (dot indicator). Clicking a date selects it for editing.
   - Add a **Staff Name** input field to each slot row (stored in the new `staff_name` column).
   - Show staff names in the admin "Published hours" preview section.

3. **Update `useKidsCareHours.ts`** hooks:
   - Add `staff_name` to the `KidsCareHourSlot` type and save/copy mutations.
   - Add a new `useKidsCareHourSlotsForMonth(year, month)` hook to fetch all slots in a month range (for calendar dot indicators).

4. **Member-facing booking modal** — no changes needed. The `staff_name` field is simply not rendered in member-facing components (the query returns it but it's ignored in the UI).

---

### Files changed

| File | Change |
|------|--------|
| **Migration** | Add `staff_name TEXT` column to `kids_care_hour_slots` |
| `src/components/member/MemberSidebar.tsx` | Add Kids Care nav item to "Bookings & Visits" |
| `src/hooks/useKidsCareHours.ts` | Add `staff_name` to types, add month-range query hook |
| `src/components/admin/KidsCareHoursEditor.tsx` | Add calendar overview with slot indicators, staff name input per slot |

