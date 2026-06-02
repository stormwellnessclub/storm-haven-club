# Add public "Leave a Review" CTA on the spa Reviews tab

## Problem

On the public spa pages (`/spa/*`) the Reviews tab shows ratings and existing reviews but has **no way for a visitor to actually leave one**. Today, reviews only come from (a) the post-appointment email token link, (b) the member/non-member portal banner, or (c) an admin-shared link.

## Goal

Make submitting a spa review obvious from the public Reviews tab, for both signed-in customers and anonymous visitors. All public submissions stay moderated.

## Scope

UI/frontend only — leverage the existing `submit_spa_review_via_token` flow plus a new "open" submission path. No changes to admin moderation (that already lives under Admin → Spa Management → Reviews).

## What to build

### 1. New `LeaveSpaReviewCTA` block at the top of `SpaReviewsTab`

A prominent card above the overall rating summary with a primary "Leave a Review" button. Behavior depends on auth state:

- **Signed-in user with pending spa appointments** → button opens the existing `SpaReviewDialog` for their appointment (reuses `usePendingSpaReviews` / `LeaveSpaReviewBanner` logic, but inline). If multiple pending, show the same "choose a treatment" picker.
- **Signed-in user with no pending appointments** OR **anonymous visitor** → button opens a new "Public Spa Review" dialog (see below).

### 2. New `PublicSpaReviewDialog` component

A lightweight dialog that does not require a token:

- Service picker (defaults to current page's service if the tab is opened with `initialServiceId`).
- Optional therapist picker (populated from `useSpaServices` → therapists assigned to that service; "Not sure / not listed" allowed).
- Star rating (required, 1–5).
- Display name (required for guests, prefilled for signed-in users).
- Email (required for guests, prefilled for signed-in users) — used only for moderation contact, not displayed publicly.
- Review text (optional, max 1000 chars).
- Honeypot field + simple per-IP/email rate-limit (1 submission / 10 min) on the backend.
- Submit calls a new RPC `submit_public_spa_review` that inserts into `spa_reviews` with `source = 'public'` and `is_published = false` (pending moderation).

Reuses the same display rules already in `get_spa_reviews_with_names` (first name + last initial, or "Guest").

### 3. Backend additions

- New SECURITY DEFINER RPC `public.submit_public_spa_review(_service_id, _therapist_id, _rating, _review_text, _display_name, _email, _honeypot)`:
  - Validates rating 1–5, honeypot empty, display name length.
  - Rate-limits by lowercased email (≤1 per 10 min, ≤3 per day).
  - Inserts into `spa_reviews` with `appointment_id = null`, `source = 'public'`, `is_published = false`, `reviewer_display_name = _display_name`, `reviewer_email = lower(_email)`.
  - Returns `{ success, error? }`.
- Add columns to `spa_reviews` if missing:
  - `reviewer_email text` (nullable, for moderation contact / rate limit; never returned by `get_spa_reviews_with_names`).
  - Extend `source` check to allow `'public'`.
- `get_spa_reviews_with_names` already filters by `is_published = true`, so unmoderated public submissions stay hidden from the tab until an admin approves.

### 4. Admin moderation surface

`Admin → Spa Management → Reviews` already lists all rows. Add:

- A "Source" column/badge (`portal`, `token`, `public`).
- A "Pending" filter chip that shows `is_published = false` rows first, with one-click Approve / Reject buttons (Reject = delete row). This makes public submissions easy to triage.

### 5. Copy + UX

- CTA card heading: "Visited the spa?"
- Subhead: "Share your experience — reviews are moderated and only your first name & last initial appear publicly."
- Button: "Leave a Review"
- Confirmation toast on submit: "Thanks — your review is in for moderation."

## Files touched

- `src/components/spa/SpaReviewsTab.tsx` — add CTA card at top, wire dialog state.
- `src/components/spa/PublicSpaReviewDialog.tsx` *(new)* — guest/public submission form.
- `src/components/spa/SpaReviewsTab.tsx` — reuse `usePendingSpaReviews` for signed-in shortcut.
- `src/pages/admin/SpaManagement.tsx` (or the existing reviews subcomponent) — add Source badge + Pending filter + Approve/Reject controls.
- Migration: extend `spa_reviews` (column + check constraint), add `submit_public_spa_review` RPC with rate-limit logic.

## Out of scope

- Changing the existing tokenized email flow.
- Changing how moderated reviews render publicly.
- SMS/email notification to admins on new public submission (can be added later if desired).
