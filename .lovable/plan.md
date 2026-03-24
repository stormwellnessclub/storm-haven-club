

# Fix Class Schedule: Freshness, Layout, Past-Class Filtering, Admin History

## Problems identified

1. **Schedule data goes stale for PWA/webpage users.** The PWA caches aggressively (`skipWaiting + clientsClaim` is fine for code updates) but the React Query `staleTime: 30_000` on `Schedule.tsx` means data is only refetched every 30 seconds — AND there is no `refetchOnFocus` or `refetchInterval`. Users who leave the tab open or use the PWA home screen shortcut can see outdated class info until they manually reload.

2. **Public /classes page shows class types without times, confusing users.** `Classes.tsx` is a catalog of class types (Pilates, Cycling, etc.) with descriptions and a "Book Class" button that just navigates to `/schedule`. There's no indication of when classes are. The small "View Weekly Schedule" banner is easy to miss. Users land here expecting to see a schedule but get a brochure.

3. **Finished classes today still show on the public /schedule page.** `Schedule.tsx` does its own inline query and does NOT filter out classes that already ended today. The `useClassSessions` hook has this filter, but the Schedule page doesn't use it. Members have to scroll past completed classes.

4. **Admin Classes page hides cancelled classes.** The query filters `.eq('is_cancelled', false)`, so once a class is cancelled, admin can never see it again. No history, no record of what happened.

## Plan

### 1. Fix schedule data freshness
- In `Schedule.tsx`, reduce `staleTime` to `0` and add `refetchOnWindowFocus: true` (React Query default, but be explicit) and `refetchInterval: 60_000` (auto-refresh every 60 seconds).
- In `useClassSessions.ts`, add `refetchInterval: 60_000` for the same reason — member-facing booking calendar stays fresh.
- This ensures anyone who opens the app or switches back to it gets current data within seconds.

### 2. Merge /classes into /schedule or make /classes clearly link to schedule
- Restructure `Classes.tsx` to prominently show the weekly schedule at the top, with the class catalog below as a secondary "Our Classes" section.
- Or: redirect `/classes` to `/schedule` and integrate the studio descriptions into the schedule page hero.
- Recommendation: redirect `/classes` → `/schedule` and add the studio info cards to the schedule page. This eliminates user confusion about which page to use.

### 3. Filter out finished today's classes on public /schedule page
- Apply the same time-based filter that `useClassSessions` uses: compare session end time to `now()` and hide classes that have already finished today.
- Extract this filter into a shared utility so both `Schedule.tsx` and `useClassSessions.ts` use the same logic.

### 4. Show cancelled classes in admin view
- Remove the `.eq('is_cancelled', false)` filter from the admin Classes page query.
- Show cancelled sessions in the list with a clear "Cancelled" badge and muted styling.
- Cancelled sessions should still be clickable to view the roster (who was booked, refund history).
- Hide the "Cancel Class" action on already-cancelled sessions (already done).
- This gives admin full history without losing data.

## Files to change
- `src/pages/Schedule.tsx` — add refetchInterval, refetchOnWindowFocus, filter finished classes today
- `src/pages/Classes.tsx` — redirect to /schedule (or merge content)
- `src/App.tsx` — update route if redirecting
- `src/hooks/useClassSessions.ts` — add refetchInterval
- `src/pages/admin/Classes.tsx` — remove is_cancelled filter, show cancelled sessions with badge
- New utility `src/lib/classSessionFilters.ts` — shared "is session finished" filter

