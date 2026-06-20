## Goal

Make the Celestial Gold milestone celebration fire for real members (class milestones: 5, 10, 25, 50, 100, 250, 500), and give the front desk a heads-up so staff can congratulate members in person — including non-members on day passes.

## How it works end-to-end

```text
Member checks in
      │
      ▼
┌─────────────────────────┐
│ Backend: count classes  │
│  - if new threshold hit │
│    → insert into        │
│      user_class_        │
│      achievements       │
└────────┬────────────────┘
         │
         ├──► Front desk roster: green star + "🎉 25th class today!"
         │     shows BEFORE class so staff can congratulate
         │
         ├──► Kiosk confirmation: brief inline gold flourish (~2s,
         │     doesn't block next check-in)
         │
         └──► Member portal: next time they open the app on phone/web,
               full Celestial Gold overlay plays for their most
               recent unseen milestone, then marks all lower
               milestones as seen
```

## What gets built

### 1. Database: track "seen" state on achievements

Add `celebrated_at` to `user_class_achievements`. Null = unseen, timestamp = celebration has played.

**Existing members backfill:** for everyone with achievements already, mark all but their single highest unseen milestone as `celebrated_at = now()`. They get exactly one catch-up celebration on next portal login.

### 2. Front desk class roster — milestone heads-up

In `src/components/kiosk/KioskClassRoster.tsx` and `src/pages/admin/ClassRoster.tsx`:

- Today's class roster fetch joins `user_class_achievements` to surface:
  - `next_milestone_in`: how many classes until their next threshold (e.g. "1 away from 25")
  - `milestone_today`: true if THIS class will push them across a threshold
- Roster row shows:
  - Gold star icon + "🎉 Will hit 25th class today" pill (yellow background) when `milestone_today` is true
  - Subtle "24/25" counter for members within 2 of a milestone
  - Works for members AND non-members (guest passes / day passes also count, joined by check-in records)

### 3. Kiosk check-in confirmation — short flourish

In `src/pages/kiosk/Reception.tsx` post-check-in screen, when the just-checked-in person crossed a milestone:
- Inline ~2s gold pulse with "25th class!" — does not block the next check-in
- Uses the same gold palette as the portal overlay for brand consistency
- Auto-dismisses; no tap needed

### 4. Member portal — full Celestial Gold overlay

- On portal/dashboard mount, query for `user_class_achievements WHERE user_id = me AND celebrated_at IS NULL ORDER BY milestone DESC LIMIT 1`
- If a row exists, mount `<MilestoneUnlockOverlay />` with that milestone
- On dismiss (tap anywhere or auto after 4.2s), update `celebrated_at = now()` for ALL unseen rows for that user (so lower ones don't queue up)
- Also fires after a real-time check-in if they happen to be in the portal at that moment (via the existing supabase channel)

### 5. Trigger logic — where milestones get awarded

Existing check-in flow inserts into `check_ins`. Add a database trigger that, after insert:
- Counts that user's lifetime check-ins
- If the count matches a threshold (5, 10, 25, 50, 100, 250, 500), inserts a row into `user_class_achievements` with `achievement_kind = 'lifetime_milestone'`, `milestone = threshold`, `celebrated_at = NULL`
- Idempotent — unique constraint on (user_id, milestone) prevents duplicates

## Out of scope (separate future work)

- Goal milestones, habit streaks, badge achievements — same overlay can wire in later, this pass is class milestones only
- Sound on unlock
- Sharing / social card

## Visual touchpoints (no new components needed)

- Reuses existing `src/components/mockup/MilestoneUnlockOverlay.tsx` — promote out of `mockup/` to `src/components/member/MilestoneUnlockOverlay.tsx`
- Reuses existing Trophy icon styling in `KioskClassRoster.tsx`