
# Per-class-type progress rings for member achievements

Keep the existing Class Milestones card and Achievements page exactly as they are today, and add a new visual section that shows progress toward the next "first {class type}" badge for each class category the member has touched (Pilates, Cycling, Yoga, Recovery, etc.).

## What the member will see

A new "Class breakdown" card (placed under the existing Class Milestones card on both `/member` dashboard and `/member/achievements`):

- One small circular ring per class type the member has ever booked (Pilates, Cycling, Yoga, etc.)
- Center of ring: total count attended for that type (e.g. `7`)
- Ring fill: progress toward the next milestone for that type (1 → 5 → 10 → 25 → 50 → 100)
- Label under ring: class type name + `next: N` hint (or a gold ✓ when already at/over the highest tier)
- Sparkle accent on rings where they've earned a "first {type}" badge
- Empty state: "Try a new class type to start a new ring" with a link to `/schedule`

Visual tone matches the existing gold/amber milestone styling — outlined gold ring on muted track, gold gradient fill once a tier completes.

## Technical details

1. New hook `src/hooks/useUserClassTypeBreakdown.ts`
   - Input: optional `userId` (defaults to current auth user)
   - Resolves linked `member_id` (same pattern as `useUserClassTotal`)
   - Single query: `class_bookings` filtered by `status = 'completed'` and `.or('user_id.eq.X,member_id.eq.Y')`, selecting `class_sessions(class_types(id,name,category))`
   - Aggregates in JS into `{ classTypeId, name, category, count }[]`, sorted by count desc
   - Returns array via React Query, cache key `["user-class-type-breakdown", uid]`

2. New component `src/components/ClassTypeBreakdownCard.tsx`
   - Renders the card shell (matches `ClassMilestonesCard` styling)
   - For each entry, computes `nextTier` from `[1,5,10,25,50,100]` and renders an SVG ring (stroke-dasharray progress) — no new deps
   - Uses existing earned `first_in_type` achievement data from `useUserClassAchievements` to add the sparkle accent
   - Handles loading skeleton and empty state

3. Mount the new card in two places, directly under the existing `<ClassMilestonesCard />`:
   - `src/pages/member/Dashboard.tsx`
   - `src/pages/member/Achievements.tsx`

4. No changes to the portal (non-member) dashboard, admin views, kiosk, or DB.

## Out of scope

- No changes to the existing Achievement points card, Achievements grid, or celebration overlays
- No new tables, RPCs, or migrations
- No styling changes to the existing Class Milestones card
