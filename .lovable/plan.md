## Goal
Extend the class-count + milestone tracking so **walk-ins / non-members with accounts** (anyone with a `user_id` but no `member_id`) get the same first-class star, lifetime count, milestone badges on rosters — and a persistent achievements record they can see in their own portal.

## What already works (from prior turn)
The new `kiosk_class_roster` RPC already counts completed bookings by `user_id` when there's no `member_id`, so non-members **already** see ⭐ First [Class Type], 🏆 lifetime count, and 🎉 milestone badges on staff rosters. No change needed there.

## What's missing — and what this plan adds

### 1. Persistent achievement records for non-members
Today `member_achievements` is keyed on `member_id` (required). Non-members have no row, so milestones aren't saved anywhere durable.

**Add** `user_class_achievements` table keyed on `user_id` (works for both members and non-members):
- `user_id` (FK → auth.users)
- `milestone` int (1, 5, 10, 25, 50, 100, 200, 500)
- `class_type_id` nullable — null = lifetime milestone, set = "first [type]" achievement
- `awarded_at`, unique on (user_id, milestone, class_type_id)

### 2. Auto-award on check-in
New SECURITY DEFINER RPC `award_class_milestones(p_booking_id uuid)` called from the existing check-in flow (`useKioskCheckIn`) after a successful check-in:
- Computes the attendee's total completed bookings (by `user_id` or `member_id → user_id`).
- Inserts any newly-crossed milestone rows (idempotent via unique constraint).
- Inserts a `first_in_type` row if this was their first booking of that class type.
- For members, ALSO mirrors into `member_achievements` so the existing member achievements page keeps working.

### 3. Portal visibility for non-members
- New hook `useUserClassAchievements()` reading from `user_class_achievements` for the current `user_id`.
- Add a small **"Class Milestones"** card on the non-member portal dashboard (`src/pages/portal/Dashboard.tsx`) showing lifetime count + earned milestones + first-class badges.
- Member achievements page (`src/pages/member/Achievements.tsx`) gets an optional "Class milestones" section pulling from the same table so members see the same data without duplication.

### 4. Backfill
One-time migration step: walk all historical `class_bookings` where `status='completed'`, group by attendee, and seed `user_class_achievements` for every milestone already crossed (and first-in-type). Idempotent.

## RLS
- `user_class_achievements`: user can SELECT their own rows; admins/front-desk/staff can SELECT all; only RPCs (security definer) INSERT.
- GRANT SELECT to authenticated; GRANT ALL to service_role.

## Files touched
- New migration: table + RPC `award_class_milestones` + backfill.
- `src/hooks/useKioskCheckIn.ts` — call `award_class_milestones` after success.
- `src/hooks/useUserClassAchievements.ts` — new.
- `src/pages/portal/Dashboard.tsx` — milestones card.
- `src/pages/member/Achievements.tsx` — class milestones section.

## Out of scope
- Walk-ins **without** an account stay untracked (no stable identity). The roster will still show them, just without history badges.
