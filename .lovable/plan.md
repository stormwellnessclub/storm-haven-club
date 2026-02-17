

# Phase 2: Health Score + Achievements Integration

## Overview

Connect amenity usage to the health score calculation and rewrite the achievement engine to evaluate all 15 achievement types instead of just "First Steps."

---

## Part A: Health Score -- Include Amenities

**File: `src/hooks/useHealthScore.ts`**

- Add a 6th parallel query for `amenity_usage_logs` counting rows where `member_id = targetMemberId` and `used_at >= periodStart`
- Add amenity dates to the `allDates` set for unique active days calculation
- Include amenity count in `totalActivities` (alongside check-ins, workouts, classes, spa)
- Add `amenities` field to the `activity_counts` object in the return value
- Update the `HealthScoreResult` and `HealthScore` interfaces to include `amenities: number` in `activity_counts`

**File: `src/pages/member/HealthScore.tsx`**

- Add a 6th tile in the Activity Breakdown grid showing the amenities count
- Update the grid from `lg:grid-cols-5` to `lg:grid-cols-6`
- Update the Activity Score description to mention amenities

---

## Part B: Rewrite `check_and_award_achievements` RPC

**Database migration** -- Drop and recreate the function to evaluate all 15 achievement criteria:

| Achievement | Type in `criteria` | Logic |
|---|---|---|
| First Check-In | `check_in` count=1 | COUNT check_ins >= 1 |
| Century Club | `check_in` count=100 | COUNT check_ins >= 100 |
| Month Master | `check_in` days_in_month=30 | COUNT check_ins in last 30 days >= 30 |
| Early Bird | `check_in` time_before=07:00 | EXISTS check_in before 7am |
| Night Owl | `check_in` time_after=20:00 | EXISTS check_in after 8pm |
| Week Warrior | `check_in_streak` days=7 | Compute consecutive check-in days >= 7 |
| First Steps (existing) | `workout_log` count=1 | COUNT workout_logs >= 1 |
| Fitness Fanatic | `workout_log` count=50 | COUNT workout_logs >= 50 |
| Spa Enthusiast | `spa_booking` count=10 | COUNT spa_appointments with status confirmed/completed >= 10 |
| Class Explorer | `class_variety` count=5 | COUNT DISTINCT class_type_id from class_bookings >= 5 |
| Wellness Warrior | `wellness_variety` all=true | COUNT DISTINCT amenity_type from amenity_usage_logs = 6 |
| Goal Crusher | `goal_complete` count=1 | EXISTS member_goals with status='completed' |
| Habit Hero | `habit_streak` days=30 | EXISTS habit_streaks with current_streak >= 30 |
| Perfect Week | `habit_week_complete` | EXISTS habit_logs covering 7 consecutive days |
| Founding Member | `founding_member` | members.is_founding_member = true |

For each achievement, the function will:
1. Check if already awarded (skip if so)
2. Evaluate the criteria
3. If met, INSERT into `member_achievements` with `achievement_type`, `achievement_name`, `description`, `member_id`, `user_id`

Social Butterfly (referral) will be skipped for now since there is no referral tracking table.

---

## Part C: Auto-trigger Achievement Check on Amenity Log

This is **already done** in Phase 1 -- the `useCreateAmenityUsage` hook calls `check_and_award_achievements` RPC on success. Once the RPC is rewritten, amenity-related achievements will be evaluated automatically.

---

## Part D: Points for Amenity Usage

This is **already done** in Phase 1 -- the `trg_amenity_usage_activity` trigger inserts 3 points into `member_activities` on every amenity log.

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useHealthScore.ts` | Add amenity query, update interfaces and score calculation |
| `src/pages/member/HealthScore.tsx` | Add amenities tile to Activity Breakdown |
| Database migration | Rewrite `check_and_award_achievements` to handle all 15 types |

## What is NOT Changing

- Achievement definitions table (already has all 15 rows)
- `useAchievements.ts` hook (reads achievements correctly)
- `useMemberAchievements.ts` hook (reads member_achievements correctly)
- Achievements page UI (already renders earned/locked states)
- Points trigger (already in place from Phase 1)
- Auto-check on amenity log (already in place from Phase 1)

