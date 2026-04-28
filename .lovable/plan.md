# Make Class Reviews Publicly Visible

## Goal

Anyone browsing `/schedule` (logged in or not) should be able to see the reviews for a class **before** deciding to book. Right now reviews only appear inside the Booking Modal, which a logged-out visitor can't even open.

## What Changes

### 1. Tap a class card → open a public "Class Details" sheet (no login required)

Currently, tapping a class card calls `onBook(session)`, which opens the `BookingModal` — a flow that requires authentication. We'll change the tap behavior so the **card itself** opens a lightweight public details panel showing:

- Class name, instructor, time, room, capacity, heated badge
- Aggregate star rating + review count
- The full `<ClassReviewsList classTypeId={...} />` (5 most recent + "Show all")
- A primary CTA at the bottom:
  - Logged-in member → **"Book Class"** (opens the existing `BookingModal`, preserving today's flow)
  - Logged-out visitor → **"Sign in to Book"** (links to `/auth`)

The existing **"Book Class" button on the card** stays for one-tap booking by logged-in members. New behavior: tapping anywhere else on the card (the title/info area) opens the details sheet.

### 2. Reviewer name resolution for anonymous visitors

The reviews table itself is already readable by anon (RLS policy `Anon can read visible reviews` exists). But `useClassReviewsForType` enriches reviews with reviewer names by querying `members` / `profiles` / `non_member_profiles` — those tables block anon, so logged-out visitors would see every review as just "Member".

Fix: add a SECURITY DEFINER RPC `get_class_reviews_with_names(_class_type_id uuid)` that returns visible reviews already joined to first name + last initial. Update `useClassReviewsForType` (non-admin path only) to call this RPC. Admin path keeps the current direct query so it can see hidden reviews.

### 3. Where this shows up

- **Public `/schedule` page** — main use case. Tap any class card → see reviews.
- **Member portal schedule** — same component, same behavior.
- The existing in-modal review section stays as-is (no harm in showing it twice; members who skip the details sheet still see them in the booking flow).

## Out of Scope

- Showing individual reviewer photos.
- Filtering/sorting reviews (newest-first only, same as today).
- Admin Dashboard "Recent Reviews" card (still pending from the prior plan — can be added separately if you want).

## Files Changed

- **New migration** — add `get_class_reviews_with_names(uuid)` SECURITY DEFINER RPC returning rating, text, created_at, is_visible, and pre-formatted `reviewer_name` resolved from members → profiles → non_member_profiles.
- `src/hooks/useClassReviews.ts` — switch `useClassReviewsForType` (non-admin) to the new RPC; admin path unchanged.
- `src/components/booking/ClassCard.tsx` — make the card body tappable (opens details), keep the action button as direct Book/Waitlist.
- **New** `src/components/booking/ClassDetailsSheet.tsx` — public details panel with class info, aggregate rating, `ClassReviewsList`, and login-aware CTA.
- `src/pages/Schedule.tsx` — wire the new sheet, manage its open state alongside the existing `BookingModal`.

## Technical Notes

- RLS on `class_reviews` already allows anon SELECT of `is_visible = true` rows — no policy change needed.
- The new RPC is the cleanest way to expose reviewer names publicly without weakening RLS on `members` / `profiles` / `non_member_profiles`.
- Reviewer name format stays "First L." (e.g. "Sarah K."), falling back to "Member" when no name is found.
