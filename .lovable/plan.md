## Add review banner to dashboards + dismissible X

Extend the existing `LeaveReviewBanner` to both the member and non-member dashboards, and add a small X button so users can dismiss it (per-session, per-banner — no DB changes needed).

### 1. Make banner dismissible

Update `src/components/reviews/LeaveReviewBanner.tsx`:
- Add optional `onDismiss?: () => void` prop.
- When provided, render a subtle X button (top-right corner, gold-light tint, hover brightens) using `lucide-react`'s `X` icon.
- Keep existing layout intact; place X absolutely positioned so it doesn't disrupt the headline.

### 2. Dismiss persistence

Use `localStorage` keyed by `storm.reviewBanner.dismissed` storing the count of unreviewed classes at dismiss time. The banner re-appears automatically when a *new* unreviewed class accumulates (i.e., current count > dismissed count). This avoids nagging while still surfacing fresh prompts.

Encapsulate the logic in a tiny hook `useReviewBannerDismissal(currentCount)` returning `{ visible, dismiss }`. Place it alongside the component in `src/components/reviews/LeaveReviewBanner.tsx` (or co-located file `useReviewBannerDismissal.ts`).

### 3. Add to Member Dashboard

`src/pages/member/Dashboard.tsx`:
- Import `usePastBookings`, `useMyReviews`, `LeaveReviewBanner`, `ReviewDialog`.
- Compute `unreviewedPast` exactly like `member/Bookings.tsx` does.
- Render `<LeaveReviewBanner>` near the top of the dashboard content (above existing widgets, below greeting).
- Wire `onLeaveReview` to open `ReviewDialog` with the most recent unreviewed booking.
- Wire `onDismiss` to the dismissal hook.

### 4. Add to Non-Member Dashboard

`src/pages/portal/Dashboard.tsx`: same integration as above, using the same hooks (non-members can review classes they attended via passes — the `useMyReviews` hook already handles both).

### 5. Refactor shared logic (small)

To avoid duplicating the unreviewed-bookings + review-target logic across four pages (member Bookings, member Dashboard, portal Bookings, portal Dashboard), extract a small hook:

`src/hooks/useUnreviewedBookings.ts`:
- Returns `{ unreviewedPast, reviewTarget, setReviewTarget, openReviewForFirst, ReviewDialogElement }` (or just the data + a helper) so each page can drop in the banner with two lines.

Update all four pages to consume it. Existing per-card review buttons on Bookings pages keep working because they already use `setReviewTarget` directly.

### Files touched

- `src/components/reviews/LeaveReviewBanner.tsx` — add X button + `onDismiss` prop
- `src/hooks/useUnreviewedBookings.ts` — new shared hook (incl. dismissal state)
- `src/pages/member/Dashboard.tsx` — render banner
- `src/pages/portal/Dashboard.tsx` — render banner
- `src/pages/member/Bookings.tsx` — switch to shared hook (light refactor)
- `src/pages/portal/Bookings.tsx` — switch to shared hook (light refactor)

No database, RLS, or edge function changes.