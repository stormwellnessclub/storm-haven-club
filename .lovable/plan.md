# Surface Class Reviews

## Problem

Members are leaving class reviews (8 visible reviews exist in the database), but they are **never displayed anywhere** except as an aggregate star rating on each class card. The full `ClassReviewsList` component exists but is not imported by any page. There is also no admin view to monitor reviews.

## What Users See Today

- `ClassCard` shows aggregate stars + count (e.g. "★ 4.6 (8)").
- Tapping a class opens the booking modal — no reviews shown.
- Admin has zero visibility into review content.

## What We'll Build

### 1. Member-facing: View reviews per class type

Add a "Reviews" section to the **Class Booking Modal** (`src/components/booking/BookingModal.tsx`):
- Show aggregate rating header (avg + count) using existing `useClassTypeRatings`.
- Render existing `<ClassReviewsList classTypeId={...} />` below class details.
- Show "No reviews yet" gracefully when empty.
- Limit to most recent 5 with a "Show all" expand toggle.

Also add the same compact reviews block to the **Class Type detail page on the public schedule** if the class title is tappable; otherwise the modal coverage is sufficient.

### 2. Admin-facing: Review management

On `src/pages/admin/ClassTypeDetail.tsx`, add a new **"Reviews" tab/section** showing:
- Aggregate rating + total count.
- List of all reviews (rating, text, reviewer name, date).
- Per-row action: **Hide** / **Unhide** (toggles `is_visible`) so admins can suppress inappropriate reviews from public view.

Add a global **"Recent Reviews"** card to `src/pages/admin/Dashboard.tsx` showing the latest 5 reviews across all classes with a link into each class type's detail page.

### 3. Reviewer name display

`class_reviews` only stores `user_id`. Display the reviewer's first name + last initial (e.g. "Sarah K.") by joining to `members` / `profiles` / `non_member_profiles` via the same fallback chain used elsewhere. Implement this in `useClassReviewsForType` (extend the hook to return `reviewer_name`) using a single batched lookup.

### 4. RLS check

Verify `class_reviews` SELECT policy allows anonymous/member reads of `is_visible = true` rows. If not, add a policy:
```
CREATE POLICY "Anyone can read visible reviews"
  ON public.class_reviews FOR SELECT
  USING (is_visible = true);
```
And a staff-can-read-all + staff-can-update policy for the admin hide/unhide action.

## Files Changed

- `src/hooks/useClassReviews.ts` — extend `useClassReviewsForType` to include reviewer name; add `useAdminUpdateReviewVisibility` mutation.
- `src/components/reviews/ClassReviewsList.tsx` — show reviewer name; optional admin "Hide" button when prop `isAdmin` is true.
- `src/components/booking/BookingModal.tsx` — embed reviews section.
- `src/pages/admin/ClassTypeDetail.tsx` — add Reviews tab/section.
- `src/pages/admin/Dashboard.tsx` — add Recent Reviews card (respect role filtering).
- New migration — RLS policies on `class_reviews` if missing.

## Out of Scope

- Editing/deleting other users' reviews (admins only hide).
- Email notifications when new reviews arrive.
- Replying to reviews.
