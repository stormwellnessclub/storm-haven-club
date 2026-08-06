# Café reviews: make them work, and make the name optional

## What's wrong today

Two confirmed problems in the café review system:

1. **Nobody but staff can read reviews.** The two public review views (`cafe_reviews_public`, `cafe_item_rating_summary`) run with the permissions of the person viewing them, and the only read rule on the underlying `cafe_reviews` table is "staff only". So for a normal member or a walk-in guest, every item shows zero reviews and no star rating — even when reviews exist.

2. **Posting a review fails.** After saving a review the app immediately asks the database to read the new row back. Since customers have no read access (problem 1), the save is rejected and the customer sees an error — so it looks like reviews can't be left at all.

3. **The name is forced.** Both the form and a database rule reject a review with a blank name ("A display name is required to submit a café review"). You want it optional.

## The fix

### 1. Let customers read approved reviews (database)

- Add a read rule on `cafe_reviews` so anyone (signed in or not) can read reviews that are **approved**. Pending/rejected reviews stay staff-only.
- Keep reviewer email and the reviewer's account ID private: revoke read access on just those two fields for public roles, so the public views keep working while personal contact info stays staff-only.

### 2. Make the name optional (database + form)

- Change the database rule so a blank name is saved as **"Anonymous"** instead of throwing an error.
- Remove the "Add a name — even a first name works" check in the review form and relabel the field "Your name (optional)".

### 3. Stop the save from failing (app)

- The review save no longer asks for the saved row back, so posting works even before the read rule is evaluated.
- Show the real database message if a save does fail, instead of a generic error.

## Result

- Star ratings and review lists appear for members, non-members, and walk-in guests on the café page and the Storm Shop page.
- "Write a review" works for guests and signed-in customers.
- Leaving the name blank posts as "Anonymous"; typing a name still shows the name.

## Technical notes

- Migration:
  - `CREATE POLICY` on `public.cafe_reviews` for `SELECT` to `anon, authenticated` with `USING (moderation_status = 'approved')`.
  - `GRANT SELECT ON public.cafe_reviews TO anon` (authenticated already has it), then `REVOKE SELECT (reviewer_email, reviewer_user_id) ON public.cafe_reviews FROM anon, authenticated` so the previously-flagged reviewer-email exposure does not come back.
  - Replace `public.cafe_reviews_before_write()` so it sets `NEW.reviewer_display_name := COALESCE(NULLIF(TRIM(...), ''), 'Anonymous')` instead of raising. Column stays `NOT NULL`.
  - Views stay `security_invoker=on` (no SECURITY DEFINER views).
- `src/hooks/useCafeReviews.ts`: drop `.select("id").single()` from the insert in `useSubmitCafeReview`; keep query invalidation.
- `src/components/cafe/CafeReviewForm.tsx`: remove the blank-name guard, send `displayName` as-is (may be empty), update the placeholder and helper copy.
- No change to moderation, photo upload, or the post-pickup review prompt.
