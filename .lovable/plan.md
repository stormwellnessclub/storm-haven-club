# Public Class Reviews

## Goal
Make class reviews visible on a public-facing class type page so prospective members and members can read them outside the booking flow. Improve the empty state to encourage first reviews.

## What you'll see
- New public route: `/classes/:classTypeId` — a class type detail page showing the class info, average rating, and full reviews list.
- On `/schedule`, each class card gets a small "View class" link/icon in addition to the existing click-to-open details panel, linking to the new public page.
- Empty state on every reviews list changes from "No reviews yet." to a friendlier "Be the first to review this class" message (with a CTA to book if not already booked).

## Pages / components changed

1. **New** `src/pages/ClassTypeDetail.tsx` (public)
   - Fetches the `class_types` row by `:classTypeId`.
   - Shows: name, category badge, hot/cool, description, duration, average rating, total reviews.
   - Renders `<ClassReviewsList classTypeId={id} initialLimit={10} />`.
   - "Book a session" CTA → links to `/schedule?type={id}`.
   - SEO title/description via existing pattern.

2. **Edit** `src/App.tsx`
   - Add public route `/classes/:classTypeId` → `ClassTypeDetail`.

3. **Edit** `src/components/reviews/ClassReviewsList.tsx`
   - Replace empty state with "Be the first to review this class" copy. If `isAdmin` keep current behavior.

4. **Edit** `src/pages/Schedule.tsx`
   - Add a small "ⓘ View class" link on each card linking to `/classes/{ct.id}` (stopPropagation so it doesn't trigger the side sheet).

5. **Edit** `src/components/booking/ClassDetailsSheet.tsx`
   - Add a "View full class page" link under the title pointing to `/classes/{classType.id}`.

## Out of scope
- No DB or RPC changes — `get_class_reviews_with_names` and `get_all_class_type_ratings` already exist and contain 8 visible reviews.
- No changes to the rating/submit flow.