## Problem

The achievement (and class-milestone) celebration overlay fires every time a member clicks any tab. Three compounding causes:

1. `MemberLayout` is wrapped inside every page file (`Dashboard.tsx`, `Achievements.tsx`, `Goals.tsx`, `Habits.tsx`, `Workouts.tsx`, `Bookings.tsx`, `Profile.tsx`, etc.), so it unmounts and remounts on every route change. Both `<AchievementCelebrationHost />` and `<MilestoneCelebrationHost />` live inside it.
2. Both hosts dedup using `useState` (`seenIds` Set in `AchievementCelebrationHost.tsx:40`, `dismissed` bool in `MilestoneCelebrationHost.tsx:14`). Those reset to empty on every remount.
3. The two queries (`useUncelebratedAchievement`, `usePendingClassMilestone`) have `staleTime: 0` + `refetchOnWindowFocus: true`, so each remount re-pulls from the database before the previous "mark as seen" write has been respected.

Net result: the DB-level `celebrated_at` write is the only real dedup, and if it's slow, races with unmount, or the realtime invalidation runs before it lands, the toast fires again on the next tab.

## Fix

Stop the host components from remounting between tabs, and add a persistent client-side dedup so even a delayed DB write can't reopen the same celebration.

1. **Persist the "already shown" set across remounts** — store seen achievement IDs and dismissed milestone IDs in `sessionStorage` instead of `useState`. Check it before firing the overlay; write to it the moment the overlay opens (not after the DB mutation resolves).
2. **Raise `staleTime`** on both hooks from `0` to `60_000` so tab clicks don't trigger an immediate refetch. Realtime inserts (which the hooks already subscribe to) still deliver newly earned achievements instantly.
3. **Fire the "mark celebrated" mutation immediately on open** (already happens for achievements), and additionally optimistically remove the row from the query cache so the next refetch can't resurrect it before the DB write lands.

This is the minimal-risk fix — it does not touch routing or move `MemberLayout` into a shared `<Outlet />`. Files touched are only the two host components and their hooks.

## Files to change

- `src/components/member/AchievementCelebrationHost.tsx` — replace `useState` Set with `sessionStorage`-backed set, mark seen immediately on open, optimistically clear the query.
- `src/components/member/MilestoneCelebrationHost.tsx` — same pattern for the dismissed flag, keyed per milestone ID.
- `src/hooks/useUncelebratedAchievement.ts` — `staleTime: 60_000`, keep realtime subscription.
- `src/hooks/usePendingClassMilestone.ts` — `staleTime: 60_000`.

No backend / RLS / schema changes. No router changes. No UI redesign.

## Verification

After the change, navigate between Dashboard → Bookings → Profile → Workouts repeatedly. The achievement overlay should appear at most once per achievement per session, and never on a tab click.