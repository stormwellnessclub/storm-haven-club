

# Member Engagement Overhaul -- Step-by-Step Game Plan

This is a large initiative broken into **5 phases**, each building on the previous. We will implement them one at a time so nothing breaks and every piece is tested before moving on.

---

## Current State (What Exists Today)

- **Check-ins** exist in the `check_ins` table but members have **no way to view their check-in history**
- **Health Score** counts check-ins and workouts but does **not** count amenity usage (only Red Light and Dry Cryo are bookable via credits -- other amenities like sauna, salt room, cold plunge, steam room are not tracked at all)
- **Achievements** has 15 defined badges but the `check_and_award_achievements` RPC only awards "First Steps" (first workout). Check-in achievements, streaks, and amenity achievements are **not being evaluated**
- **Workouts** page has AI generation and logging, but the log form uses a generic type dropdown -- no way to build a workout exercise-by-exercise using club equipment
- **Admin Support** can only reply to member-initiated conversations -- admin **cannot start a new conversation** with a member
- **Amenity usage** (sauna, salt room, cold plunge, steam room, zero body cryo, red light) is **not tracked at all** beyond the credit-based bookings for Red Light and Dry Cryo

---

## Phase 1: Check-In History + Amenity Usage Logging

**Goal:** Give members visibility into their visit history and let them log which amenities they used during each visit.

### Database Changes
- **New table: `amenity_usage_logs`**
  - `id`, `member_id`, `user_id`, `amenity_type` (enum: sauna, salt_room, cold_plunge, steam_room, zero_body_cryo, red_light_therapy), `used_at` (timestamptz), `duration_minutes` (int, nullable), `notes` (text, nullable), `check_in_id` (uuid, nullable, FK to check_ins), `created_at`
  - RLS: members can INSERT/SELECT their own rows; staff can SELECT all

### Frontend Changes
- **New member page: `/member/check-in-history`** -- Shows a scrollable list of all check-ins with dates/times, plus any amenities logged for that visit
- **Amenity logging widget** on the check-in history page or a quick-action button on the member dashboard -- member taps "Log Amenity" and picks from the 6 amenity types with optional duration
- **Member sidebar** -- Add "Visit History" link under My Account section

### Admin Visibility
- **Member Detail Sheet** -- Add an "Activity" tab showing check-in history + amenity usage for that member
- **New admin report** -- "Amenity Utilization Report" showing which rooms are most used, broken down by hour/day of week

---

## Phase 2: Amenities Count Toward Health Score + Achievements

**Goal:** Make amenity usage contribute to health scores, points, and achievement unlocks.

### Health Score Update
- Modify `useHealthScore.ts` to query `amenity_usage_logs` in the same period alongside check-ins, workouts, classes, and spa services
- Add amenity count to `activity_counts` (new field: `amenities`)
- Each amenity usage contributes to the activity score the same way spa services do

### Achievement Engine Upgrade
- Rewrite the `check_and_award_achievements` database function to evaluate ALL achievement criteria types:
  - `check_in` count and streaks (First Check-In, Week Warrior, Century Club, Month Master)
  - `check_in` time-based (Early Bird, Night Owl)
  - `workout_log` count (Fitness Fanatic, plus the existing First Steps)
  - `spa_booking` count (Spa Enthusiast)
  - `wellness_variety` -- awarded when member has logged all 6 amenity types
  - `class_variety` -- count distinct class types attended
  - `check_in_streak` -- consecutive days with check-ins
  - `habit_streak` and `habit_week_complete`
  - `goal_complete`
  - `founding_member`
- Auto-trigger achievement check when amenity is logged (same pattern as workout logging)

### Points for Amenity Usage
- Add a trigger or client-side insert into `member_activities` when an amenity is logged (3 points per amenity use, same as kids care bookings)

---

## Phase 3: Custom Workout Builder (Write Your Own)

**Goal:** Let members build and save their own workout, exercise by exercise, using club equipment or freeform.

### Database Changes
- No new tables needed -- the existing `workout_logs` table already stores workouts with a `notes` field
- **However**, the current schema lacks a structured exercises column. We will add:
  - `exercises` (jsonb, nullable) column to `workout_logs` -- array of `{ name, sets, reps, weight, duration, equipment, notes }`

### Frontend Changes
- **Enhanced workout log form** -- Instead of just "Workout Type + Duration + Notes", add:
  - A dynamic exercise list builder where the member can add exercises one by one
  - Each exercise row: name (free text or search from club equipment list), sets, reps, weight, duration
  - Equipment suggestions pulled from the `equipment` table (Technogym Skillrun, BioStrength, etc.)
  - "Save as Template" option so they can re-use workouts
- **Workout templates** stored in a new table `workout_templates` with `member_id`, `template_name`, `exercises` (jsonb)
- Members can tap "Use Template" to pre-fill the log form

### Admin Visibility
- Workout logs already visible in member detail -- the enhanced data (exercises, equipment used) will show there too

---

## Phase 4: Admin-Initiated Messaging

**Goal:** Allow admin/staff to start a conversation with any member, not just reply to existing ones.

### Frontend Changes
- **Admin Support page (`/admin/emails`)** -- Add a "New Message" button that opens a dialog where staff can:
  - Search/select a member by name or email
  - Enter a subject and message
  - Send -- creates a new `email_conversations` row with the member's `user_id` and an initial `email_messages` row with `sender_type: 'staff'`
- The member sees this new conversation in their Support tab immediately
- Optionally send an email notification via the `send-email` edge function

### No Database Changes Needed
- The `email_conversations` and `email_messages` tables already support this -- we just need to allow admin to create conversations targeting a specific user_id

---

## Phase 5: Amenity Utilization Report (Admin)

**Goal:** Give admin a clear picture of which amenities are most popular and when.

### Frontend Changes
- **New report in Report Center** -- "Amenity Utilization" report showing:
  - Total usage per amenity type (bar chart)
  - Usage by day of week (heatmap or grouped bar chart)
  - Usage by hour of day (to identify peak times)
  - Top 10 most active members by amenity usage
  - Trend over time (line chart, weekly/monthly)
- Add to `src/lib/reportDefinitions.ts`

---

## Implementation Order

We will tackle these step by step:

1. **Phase 1** first (check-in history + amenity logging) -- this is the foundation
2. **Phase 2** next (connect to health score + achievements) -- builds on Phase 1 data
3. **Phase 3** (custom workout builder) -- independent, can run in parallel with Phase 2
4. **Phase 4** (admin messaging) -- small, independent feature
5. **Phase 5** (utilization report) -- needs Phase 1 data to exist

---

## Technical Details

### Files Created (New)
- `src/pages/member/CheckInHistory.tsx` -- Member check-in history page
- `src/hooks/useCheckInHistory.ts` -- Fetch member check-ins
- `src/hooks/useAmenityUsage.ts` -- CRUD for amenity usage logs
- `src/components/member/LogAmenityDialog.tsx` -- Quick amenity logging modal
- `src/components/member/WorkoutExerciseBuilder.tsx` -- Exercise-by-exercise form
- `src/hooks/useWorkoutTemplates.ts` -- Save/load workout templates
- `src/components/admin/reports/reports/AmenityUtilizationReport.tsx`

### Files Modified
- `src/App.tsx` -- Add `/member/check-in-history` route
- `src/components/member/MemberSidebar.tsx` -- Add "Visit History" link
- `src/hooks/useHealthScore.ts` -- Include amenity counts
- `src/hooks/useWorkoutLogs.ts` -- Support exercises jsonb
- `src/pages/member/Workouts.tsx` -- Enhanced workout builder UI
- `src/pages/admin/EmailManagement.tsx` -- Add "New Message to Member" button
- `src/lib/reportDefinitions.ts` -- Add amenity report definition
- Database: `check_and_award_achievements` function rewrite

### Database Migrations
- Create `amenity_usage_logs` table with RLS
- Create `workout_templates` table with RLS
- Add `exercises` jsonb column to `workout_logs` (if not already present)
- Rewrite `check_and_award_achievements` RPC to handle all 15 achievement types
- Add trigger on `amenity_usage_logs` to insert into `member_activities` (3 points)

