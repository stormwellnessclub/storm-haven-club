## Problem

15 achievements exist (Century Club, Week Warrior, Spa Enthusiast, etc.) and a `check_and_award_achievements(_member_id)` RPC calculates them correctly. But only **1 row** exists in `member_achievements` across the entire database because:
- The RPC is only called once per session on Dashboard mount
- No DB triggers wire it to check-ins, workouts, spa appointments, habits, or goals
- Existing members who already qualify (100+ check-ins, 30-day streaks, etc.) have nothing
- Even when awarded, no celebration ever fires — members have to navigate to the Achievements page to discover them

## Solution

### 1. Backfill (migration)

Loop `check_and_award_achievements(id)` over every member. This inserts every achievement each one currently qualifies for. For each member, mark all but their single highest-value (`points_reward`) achievement as already celebrated (`celebrated_at = now()`), leaving exactly **one** uncelebrated row queued for next portal visit — same pattern as class milestones, no flood.

### 2. Auto-fire going forward (DB triggers)

Add lightweight `AFTER INSERT` triggers on the source tables that call the RPC for the affected member:
- `check_ins` → covers First Check-In, Century Club, Month Master, Week Warrior, Early Bird, Night Owl
- `workout_logs` → Fitness Fanatic
- `spa_appointments` (when status becomes confirmed/completed) → Spa Enthusiast
- `class_bookings` (status confirmed/completed) → Class Explorer
- `amenity_usage_logs` → Wellness Warrior
- `habit_logs` / `habit_streaks` → Habit Hero, Perfect Week
- `member_goals` (status → completed) → Goal Crusher

Founding Member and Social Butterfly stay on the existing Dashboard-mount check.

The RPC already no-ops if the row exists, so triggers are idempotent and cheap.

### 3. Celebration UI (tiered)

Add `celebrated_at` column to `member_achievements`. New `useUncelebratedAchievement` hook polls + realtime-subscribes for any row with `celebrated_at IS NULL` for the current user.

Three celebration tiers driven by `achievement_type`:

| Tier                 | Achievements                                                                                         | UI                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Founding Member**  | `founding_member`                                                                                    | Unique full-screen overlay — deep navy + warm gold, "Founding Member" wordmark, subtle particle shimmer, "Thank you for being here from day one" copy. Distinct from class-milestone gold. |
| **Big (overlay)**    | Century Club, Month Master, Week Warrior, Perfect Week, Habit Hero, Goal Crusher, Wellness Warrior, Class Explorer, Fitness Fanatic, Spa Enthusiast | Reuse existing Celestial Gold overlay (same component as class milestones), with achievement name + icon + description |
| **Small (toast)**    | First Check-In, Early Bird, Night Owl, Social Butterfly                                              | Sonner toast, gold accent, achievement icon, ~5s duration                                                              |

A single `<AchievementCelebrationHost />` component mounted in both `MemberLayout` and `PortalLayout` (so non-members get them too — same parity we just did for class milestones). It dequeues one uncelebrated row at a time, routes to the right tier, then marks `celebrated_at = now()`.

## Files to add

- `supabase/migrations/<ts>_achievements_backfill_and_triggers.sql` — adds `celebrated_at`, backfills all members, creates the 7 triggers
- `src/components/member/AchievementCelebrationHost.tsx`
- `src/components/member/AchievementOverlayBig.tsx` (gold overlay, name-driven)
- `src/components/member/FoundingMemberOverlay.tsx` (unique navy/gold treatment)
- `src/hooks/useUncelebratedAchievement.ts`

## Files to edit

- `src/components/member/MemberLayout.tsx` — mount host
- `src/components/portal/PortalLayout.tsx` — mount host (non-member parity)

## Out of scope

- No changes to the existing Achievements page UI
- No changes to point rewards or criteria
- Class milestones (already shipped) are untouched
