
# Strategic Campaign System — IMPLEMENTED

## What Was Built

### 1. Campaign Playbooks (CampaignPlaybooks.tsx)
Goal-driven campaign cards replacing the generic "Compose Campaign" button:

**Guest Playbooks:**
- **Convert to Applicant** — targets past guests who haven't applied
- **Re-engage Lapsed Guests** — guests who visited 30+ days ago
- **Collect Feedback** — recent guests without feedback

**Member Playbooks:**
- **Prevent Churn** — members with past_due or frozen status
- **Upsell Tier** — active members on lower tiers
- **Referral Push** — active members with 0 referrals

Each card shows live audience count and a "Launch Campaign" button.

### 2. Smart Audience Builder (ComposeEmailDialog.tsx)
- Auto-queries the right segment when launched from a playbook
- Shows recipient count and name chips with ability to remove individuals
- Auto-loads matching email template based on goal type
- Merge field chips for quick personalization

### 3. Conversion Tracking (CampaignAnalytics.tsx)
- `goal_type` and `goal_metadata` columns added to email_campaigns
- Per-campaign conversion rates with 14-day attribution window
- Real conversion queries: guest→applicant, re-engagement, feedback, churn prevention, referrals
- Summary stats: total conversions, overall conversion rate

### Database Changes
- Added `goal_type TEXT` and `goal_metadata JSONB` to `email_campaigns` table

---

# Kids Care System — Admin Hours + Dual Checkout + Capacity Tracking — IMPLEMENTED

## What Was Built

### 1. Database: `kids_care_hours` Table
- `week_start`, `day_of_week`, `open_time`, `close_time`, `is_closed`, `notes`
- Unique constraint on (week_start, day_of_week)
- RLS: staff CRUD, authenticated read

### 2. New Columns on `kids_care_bookings`
- `parent_confirmed_pickup` (boolean) — parent confirms pickup
- `parent_confirmed_at` (timestamptz) — when confirmed
- `room` (text) — "Little Stars" or "Big Stars"

### 3. Admin Hours Tab (`/admin/childcare` → Hours tab)
- Week-by-week hour editor with forward/back navigation
- Toggle open/closed per day, set open/close times
- "Copy Previous Week" button
- Save upserts to `kids_care_hours`

### 4. Room Capacity Dashboard (Admin Bookings tab)
- Per-room breakdown in 2-hour time blocks
- Color-coded: green (available), yellow (near full), red (full)
- Shows Little Stars (cap 8) and Big Stars (cap 6)

### 5. Dual Checkout Flow
- Staff marks checkout via existing button
- Admin cards show "Awaiting parent pickup confirmation" after staff checkout
- Parents see "Confirm Pickup" button at `/member/kids-care-bookings`
- Both timestamps visible on admin cards

### 6. Dynamic Public Hours (`/kids-care`)
- Fetches current week hours from `kids_care_hours` table
- Shows "Hours not yet published" when no hours set
- Soft launch banner updated to reflect dynamic hours

### 7. Booking Modal Slot Filtering
- Fetches hours for selected date
- Shows closed/no-hours warning if day unavailable
- Filters time slots to only show within published open/close window
- Auto-assigns room based on age group

### 8. Member Portal (`/member/kids-care-bookings`)
- View active and past Kids Care bookings
- Confirm Pickup button for checked-out bookings
- Cancel booking with reason dialog

### Files Created/Updated
- `src/hooks/useKidsCareHours.ts` (new)
- `src/components/admin/KidsCareHoursEditor.tsx` (new)
- `src/components/admin/KidsCareCapacityDashboard.tsx` (new)
- `src/pages/member/KidsCareBookings.tsx` (new)
- `src/pages/admin/Childcare.tsx` (updated — 3 tabs)
- `src/pages/KidsCare.tsx` (updated — dynamic hours, soft launch disabled)
- `src/components/booking/KidsCareBookingModal.tsx` (updated — slot filtering)
- `src/hooks/useKidsCareBooking.ts` (updated — room field, new types)
- `src/App.tsx` (updated — new route)
