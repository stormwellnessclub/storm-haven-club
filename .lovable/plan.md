

## Plan: Upgrade Kids Care Hours to Date-Based with Multiple Time Ranges

### Problem
The current `kids_care_hours` table uses `week_start` + `day_of_week` as its unique key, which means:
1. You can only set hours by day-of-week, not by specific date
2. Each day only supports a single open/close time range (no split shifts like 9am-12pm and 4pm-7pm)

### Solution

#### 1. New Database Table: `kids_care_hour_slots`
Replace the single-range-per-day model with a date-based, multi-slot table:

```sql
CREATE TABLE public.kids_care_hour_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date DATE NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  label TEXT,              -- e.g. "Morning", "Evening"
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- Keyed by **specific date**, not week+day
- Multiple rows per date = multiple time ranges
- RLS: staff can manage, members can read

#### 2. Updated Admin Editor (`KidsCareHoursEditor`)
- Switch from week navigator to a **date picker** (pick a specific date)
- Show that date's time slots as a list
- **"Add Time Slot"** button to add another open/close range for that date
- Remove/edit individual slots
- **"Copy to dates"** button: copy the current date's slots to other selected dates (for quickly setting up a week)
- Each slot row: open time, close time, optional label, optional notes, delete button

#### 3. Updated Hook (`useKidsCareHours`)
- `useKidsCareHourSlotsForDate(date)` — fetch all slots for a specific date
- `useSaveKidsCareHourSlots(date, slots[])` — delete existing slots for that date and insert new ones
- `useKidsCareHoursForDate` (member-facing) — updated to query new table, returns array of slots instead of single range

#### 4. Updated Booking Modal
- The `KidsCareBookingModal` currently uses `useKidsCareHoursForDate` to filter available time slots. Update it to work with multiple slot ranges per date instead of a single open/close window.

#### 5. Keep Old Table
The existing `kids_care_hours` table stays untouched (no data loss). New code reads from the new `kids_care_hour_slots` table. If no slots exist for a date, Kids Care is closed that day.

### Files Changed
- **New migration**: Create `kids_care_hour_slots` table with RLS
- **`src/hooks/useKidsCareHours.ts`**: Add new hooks for slot-based queries, update member-facing hook
- **`src/components/admin/KidsCareHoursEditor.tsx`**: Rewrite to date-picker + multi-slot UI
- **`src/components/booking/KidsCareBookingModal.tsx`**: Update to handle multiple time ranges

