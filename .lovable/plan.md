# Fix café review submission errors

## What's wrong
The last café review saved was Oct 8. Since then, every member who submits a review in the portal gets an error. When a review is sent, the app saves it and then asks to read back its new ID. Signed-in members are allowed to save reviews but are no longer allowed to read that table, so the read-back fails and the whole submission is rejected.

## Fix
1. Let signed-in members read the café reviews table again. The existing privacy rules stay in place, so members can still see only approved reviews and their own reviews. Café staff can still see every review.
2. Leave guest access unchanged. Guests can still submit without signing in, but they can't read the table.
3. Make the submit step safer: if the read-back ever fails after the review is already saved, the member still gets a success message, so they don't resubmit and create duplicates.
4. Show a clear message in the review form when a submission actually fails, not a raw error.

## Verify
- Sign in as a real member, submit a test review on a café item, and confirm it saves and the form shows success. Then delete that test review so no real records change.
- Confirm the public café page still shows only approved reviews.

## Technical details
- `authenticated` has INSERT but no SELECT on `public.cafe_reviews`, and `useSubmitCafeReview` does `.insert().select("id").single()`, which needs SELECT for RETURNING. This causes the permission-denied error.
- Migration: `GRANT SELECT, UPDATE, DELETE ON public.cafe_reviews TO authenticated; GRANT ALL ON public.cafe_reviews TO service_role;` RLS policies stay as they are.
- In `useCafeReviews.ts`, generate the review id on the client and insert it without `.select()`, so the submit no longer depends on read-back.
