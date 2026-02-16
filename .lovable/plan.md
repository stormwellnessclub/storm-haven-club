

## Make Wellness Features Engaging, Accurate, and Visible

### Overview

This plan fixes broken tracking, removes confusing UI, and creates a more motivating wellness experience across the member portal.

---

### 1. Remove Equipment Picker from Fitness Profile

Since all club equipment is available to every member, the equipment selection section in the Fitness Profile is confusing.

**Change**: Remove the entire "Available Equipment" section from `FitnessProfile.tsx`. The AI workout generator will automatically use all active equipment from the `equipment` table (it already queries this server-side in the edge function). Keep the `equipment_ids` field in the schema for backward compatibility but auto-populate it with all active equipment IDs when saving the profile.

| File | Change |
|------|--------|
| `src/pages/member/FitnessProfile.tsx` | Remove the equipment grid/checkbox section from the "Equipment & Time" card. Rename the card to just "Workout Time". Remove the `useAllEquipment` import. |

---

### 2. Fix Health Score to Use Real Data

The current health score derives fake sub-scores and hardcodes most activity counts to 0.

**Change**: Update `useHealthScore.ts` to query real activity data for the period:
- **Classes**: Count from `bookings` table where `status = 'confirmed'` or `'attended'`
- **Spa Services**: Count from `spa_appointments`
- **Workouts**: Count from `workout_logs`
- **Check-ins**: Already works (queries `check_ins`)
- **Unique Days**: Count distinct dates across all activity tables

Compute real sub-scores:
- **Activity Score** (0-40): Based on total activities (classes + spa + workouts + check-ins), scaled so 20+ activities in the period = 40
- **Consistency Score** (0-30): Based on unique active days vs total days in period
- **Goal Progress Score** (0-30): Average progress percentage of active goals from `member_goals`

| File | Change |
|------|--------|
| `src/hooks/useHealthScore.ts` | Replace fake derived scores with real queries to bookings, spa_appointments, workout_logs, check_ins, and member_goals tables |

---

### 3. Fix Achievements Tracking

The `useMemberAchievements` hook incorrectly maps `a.id` (the row's own ID) as `achievement_id`, so earned achievements never match the master achievements list.

**Change**: Fix the mapping to use the actual `achievement_id` column from the `member_achievements` table.

| File | Change |
|------|--------|
| `src/hooks/useAchievements.ts` | Fix line ~80: change `achievement_id: a.id` to `achievement_id: a.achievement_id` (use the actual column). Also verify the column name exists in the table schema. |

---

### 4. Enhance the Member Dashboard Wellness Section

The current dashboard shows wellness data but it's static and doesn't motivate action. Make it more engaging:

**4a. Add a "Daily Check-In" card** at the top of the wellness section:
- Shows today's habits as quick-toggle checkboxes (already partially done but buried)
- Displays current streak count prominently with a flame icon
- Shows a motivational message when all habits are complete

**4b. Add a "Next Achievement" teaser card**:
- Shows the closest locked achievement with progress toward it
- Example: "3 more workouts to unlock 'Fitness Warrior'!"
- Creates a clear call-to-action to keep going

**4c. Improve the Goals widget**:
- Show the single most urgent active goal with a visual progress ring
- Include days remaining until target date
- Add a quick "Log Progress" button inline

**4d. Add weekly summary nudge**:
- A small banner that appears once a week: "You worked out 4 times this week -- that's 1 more than last week!"
- Computed from `workout_logs` and `check_ins`

| File | Change |
|------|--------|
| `src/pages/member/Dashboard.tsx` | Restructure the Health & Wellness section with the enhanced widgets described above. Add "Next Achievement" card. Improve Goals widget with progress ring and inline action. |

---

### 5. Auto-Check Achievements on Activity

Currently, achievements only update when a member manually clicks "Check Achievements" on the Achievements page. This means most members will never see their achievements unlock.

**Change**: Trigger the `check_and_award_achievements` RPC automatically:
- After logging a workout (in `useWorkoutLogs`)
- After completing a habit (in `useHabitLogs`)
- When the dashboard loads (debounced, max once per session)

| File | Change |
|------|--------|
| `src/hooks/useWorkoutLogs.ts` | In `onSuccess` of `useCreateWorkoutLog`, call `check_and_award_achievements` |
| `src/hooks/useHabitLogs.ts` | In `onSuccess` of `useCreateHabitLog`, call `check_and_award_achievements` |
| `src/pages/member/Dashboard.tsx` | Add a one-time achievement check on mount (with sessionStorage guard to avoid repeated calls) |

---

### Technical Summary

| File | Type | What Changes |
|------|------|-------------|
| `src/pages/member/FitnessProfile.tsx` | Edit | Remove equipment selection grid; rename card |
| `src/hooks/useHealthScore.ts` | Edit | Query real activity data; compute real sub-scores |
| `src/hooks/useAchievements.ts` | Edit | Fix achievement_id mapping bug |
| `src/pages/member/Dashboard.tsx` | Edit | Enhanced wellness widgets, next-achievement teaser, auto-check achievements on load |
| `src/hooks/useWorkoutLogs.ts` | Edit | Auto-check achievements after logging workout |
| `src/hooks/useHabitLogs.ts` | Edit | Auto-check achievements after logging habit |

No database migrations are needed -- all tables and RPCs already exist.

