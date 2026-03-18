

## Plan: Admin-Managed Weekly Hours + Dual Checkout + Room Capacity Tracking

### Summary
Three additions to the Kids Care system:
1. **Admin weekly hours editor** — you set hours per day, per week, and can expand as demand grows
2. **Dual checkout confirmation** — staff marks checkout AND parent confirms pickup in their portal
3. **Room capacity tracking per 2-hour slot** — track and enforce how many kids are in each room per time block

---

### 1. Database Changes

**New table: `kids_care_hours`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| week_start | date | Monday of the week |
| day_of_week | integer | 0=Sun through 6=Sat |
| open_time | time | |
| close_time | time | |
| is_closed | boolean | default false |
| notes | text | internal notes |
| created_by | uuid | FK auth.users |
| created_at / updated_at | timestamptz | |

Unique constraint on (week_start, day_of_week). RLS: staff can CRUD, authenticated can read.

**Add columns to `kids_care_bookings`**
- `parent_confirmed_pickup` (boolean, default false) — parent confirms they picked up the child
- `parent_confirmed_at` (timestamptz, nullable) — when parent confirmed
- `room` (text, nullable) — "Little Stars" or "Big Stars", auto-assigned from age_group

---

### 2. Admin Hours Tab (`src/pages/admin/Childcare.tsx`)

Add a third tab **"Hours"** to the existing Bookings / Interest Waitlist tabs:
- Week picker (defaults to current week, forward/back navigation)
- For each day: open time, close time, or mark as closed
- "Copy Previous Week" button to quickly replicate
- Save upserts to `kids_care_hours`
- Visual indicator when a week has no hours set

---

### 3. Room Capacity Dashboard (Admin Bookings Tab)

Add a capacity summary card above the booking cards showing:
- Per-room breakdown for the selected date
- Split into 2-hour time blocks (e.g., 9-11am, 11am-1pm)
- Shows current count vs capacity (Little Stars: X/8, Big Stars: X/6)
- Color-coded: green (available), yellow (near full), red (full)

Query: group bookings by room + overlapping 2-hour blocks for the selected date.

---

### 4. Dual Checkout Flow

**Staff side** (admin Childcare page):
- Current "Check Out" button remains for staff to mark `checked_out` status
- After staff checkout, card shows "Awaiting parent pickup confirmation"

**Parent side** (member portal — new section or existing bookings view):
- After staff checks out, parent sees a "Confirm Pickup" button on their active/today booking
- Tapping it sets `parent_confirmed_pickup = true` and `parent_confirmed_at = now()`
- Until both are done, booking shows as "Pending Pickup Confirmation"

**Admin visibility:**
- Booking cards show both timestamps: staff checkout time + parent confirmation time
- Filter/highlight bookings where staff checked out but parent hasn't confirmed yet

---

### 5. Public Page + Booking Modal Updates

**`src/pages/KidsCare.tsx`:**
- Replace hardcoded `hours` array with dynamic fetch from `kids_care_hours` for current week
- Set `isSoftLaunch = false` to enable booking
- Show "Hours not yet published" if no hours exist for the current week

**`src/components/booking/KidsCareBookingModal.tsx`:**
- On date selection, fetch hours for that day from `kids_care_hours`
- If day is closed or no hours set, show message and block booking
- Filter `TIME_SLOTS` to only show times within the published open/close window
- Auto-assign `room` based on child's age group (Infants/Toddlers → Little Stars, Preschool/School Age → Big Stars)
- Check room capacity for the selected 2-hour block before confirming

---

### 6. New Hook: `src/hooks/useKidsCareHours.ts`
- `useKidsCareHoursForWeek(weekStart)` — admin: all 7 days
- `useKidsCareHoursForDate(date)` — member: single day lookup
- `useSaveKidsCareHours()` — admin mutation (upsert)
- `useConfirmPickup(bookingId)` — parent mutation

---

### Files to Create/Update
- **Migration**: `kids_care_hours` table + new columns on `kids_care_bookings`
- **Create**: `src/hooks/useKidsCareHours.ts`
- **Update**: `src/pages/admin/Childcare.tsx` — hours tab + capacity dashboard
- **Update**: `src/pages/KidsCare.tsx` — dynamic hours, disable soft launch
- **Update**: `src/components/booking/KidsCareBookingModal.tsx` — slot filtering, room assignment, capacity check
- **Update**: `src/hooks/useKidsCareBooking.ts` — add room field to booking insert
- **Update**: `src/hooks/useAdminKidsCareBookings.ts` — include room + parent confirmation fields
- **Create/Update**: Member portal bookings view — add "Confirm Pickup" button

