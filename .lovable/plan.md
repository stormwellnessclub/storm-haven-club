## Fix: class review submission fails RLS

### Root cause

The `class_reviews` INSERT policy requires all of:
- `user_id = auth.uid()`
- booking exists, belongs to the user, status is `confirmed` or `completed`
- session's `session_date + end_time` (America/Chicago) is `<= now()`

The member portal's "past bookings" list uses a looser client-side notion of "past" than the policy's strict end-time-in-Chicago check, and bookings with status `no_show` are excluded entirely. Result: the Leave Review button appears, but the INSERT is rejected with `new row violates row-level security policy for table "class_reviews"` and the user sees the generic "failed to submit review" toast.

### Fix

1. **Add a `SECURITY DEFINER` RPC `submit_class_review(booking_id, class_type_id, session_id, rating, review_text)`** that:
   - Requires `auth.uid()` (rejects anon).
   - Loads the booking + session; verifies the booking belongs to the caller.
   - Accepts booking statuses `confirmed`, `completed`, and `no_show` (member showed up or was expected; they can still rate the class).
   - Verifies the session end time (America/Chicago) is in the past — raises a friendly error if the class hasn't ended yet.
   - Enforces "one review per booking" via existing unique constraint / explicit check.
   - Inserts into `class_reviews` and returns the new row id.
   - `SET search_path = public`.

2. **Update `useSubmitReview` in `src/hooks/useClassReviews.ts`** to call the RPC instead of a direct `insert`, and surface the RPC error message via toast so members see *why* it failed (e.g. "Class hasn't ended yet") instead of the generic message.

3. **Tighten the client gate** in `src/pages/member/Bookings.tsx` and `src/pages/portal/Bookings.tsx`: only show the review CTA when the session end time (Chicago) is in the past, matching the RPC's rule. Prevents the button from appearing prematurely.

4. **Keep the RLS INSERT policy in place** as a defense-in-depth backstop, but widen it slightly to also allow `no_show` so the policy no longer contradicts the RPC's intent. The RPC remains the primary write path.

No changes to reads, to the ratings aggregation, or to `ReviewDialog` UI.

### Technical details

- Migration adds the RPC and alters the INSERT policy's status filter to `ARRAY['confirmed','completed','no_show']::booking_status[]`.
- RPC grants: `GRANT EXECUTE ... TO authenticated`.
- Client change is limited to `useSubmitReview` and the two Bookings pages' filter for `unreviewedPast` / review-button visibility.
- No schema columns change; `useMyReviews`, `useClassTypeReviews`, admin visibility toggling untouched.
