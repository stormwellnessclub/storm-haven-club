## Why members can't leave reviews

The "Leave Review" button is hidden the same day a class runs.

- `usePastBookings` only treats a class as "past" if `session_date < today`, so a class that finished this morning doesn't show up under Past Bookings until midnight, and no review button is rendered.
- The RLS INSERT policy on `class_reviews` mirrors this: `session_date < CURRENT_DATE`, so even if we surfaced the button, the submission would be blocked until the next day.
- Secondary issue: when any submit does fail, the toast says only "Failed to submit review" — we can't diagnose real failures in the field.

Members told us they want to review right after the class ends, so we fix both layers.

## What changes

### 1. Same-day "past" detection (client)

Add a helper `hasSessionEnded(session_date, end_time)` in `src/lib/clubTime.ts` that returns true once the session's end time has passed in America/Chicago wall time (the club's authoritative timezone).

Update `src/hooks/useBooking.ts`:
- `usePastBookings`: include a booking if the session has ended (`hasSessionEnded`) OR status is `completed` / `cancelled` / `no_show`.
- `useUpcomingBookings`: exclude bookings whose session has already ended today (so a class that finished at 10am doesn't sit in both Upcoming and Past).

Update `src/pages/portal/Bookings.tsx` (non-member portal): replace the string-compare `session_date >= today` / `< today` split with the same `hasSessionEnded` check so non-members get the same behavior.

Member `src/pages/member/Bookings.tsx` and both dashboards already derive from `usePastBookings`, so they pick up the fix automatically. `unreviewedPast` filters already accept anything that isn't `cancelled`.

### 2. Same-day reviews (RLS)

New migration replacing the `class_reviews` INSERT policy `"Users can review their own past bookings"`:

```sql
-- old:   AND cs.session_date < CURRENT_DATE
-- new:   AND ((cs.session_date::timestamp + cs.end_time)
--              AT TIME ZONE 'America/Chicago') <= NOW()
```

That lets a member submit as soon as the session's Chicago-local end time is in the past, and still blocks reviews for classes that haven't happened yet. `status IN ('confirmed','completed')` stays — every past booking in the last 30 days has one of those two statuses, so no one is stuck.

### 3. Better error surfacing

In `src/hooks/useClassReviews.ts` `useSubmitReview.onError`, keep the friendly "already reviewed" branch, but for every other error show the underlying Supabase message (e.g. `err.message` or `err.details`) in the toast so the next report tells us exactly which rule tripped.

## Out of scope (flagged, not fixed here)

- 324 old `confirmed` past bookings never got flipped to `completed`. RLS already allows reviews on `confirmed`, so this doesn't block the button, but the session-completion sweep is worth a follow-up.
- Review discoverability (banner is dismissible, only surfaces the next unreviewed class) — separate UX pass if you want a stronger prompt.

## Files touched

- `src/lib/clubTime.ts` — add `hasSessionEnded` helper
- `src/hooks/useBooking.ts` — same-day past/upcoming detection
- `src/pages/portal/Bookings.tsx` — use `hasSessionEnded` for the past/upcoming split
- `src/hooks/useClassReviews.ts` — surface real error message in toast
- New migration — swap `class_reviews` INSERT policy to Chicago end-time check

No changes to `ReviewDialog`, banners, or the review-rendering RPCs.