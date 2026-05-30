# Make spa reviews easy to find

## Where it lives today

The spa review flow already exists (`LeaveSpaReviewBanner` → `SpaReviewDialog`, gated by `usePendingSpaReviews` which returns each member's completed appointments without a review). The problem is **visibility** — the banner is only rendered in **one place**:

- `src/pages/portal/Bookings.tsx` (non-member portal → Bookings tab)

It's missing from every member-side surface and from the non-member dashboard, so most people with a completed spa appointment never see a prompt.

## What I'll add

Drop the existing `LeaveSpaReviewBanner` into the surfaces where people already check on their appointments — no new components, no backend changes:

1. **Member portal — My Bookings** (`src/pages/member/Bookings.tsx`)
   Place it right under the existing class `LeaveReviewBanner` so members see both class + spa review prompts in one spot.

2. **Member portal — Dashboard** (`src/pages/member/Dashboard.tsx`)
   Same placement: directly under the class `LeaveReviewBanner` block.

3. **Non-member portal — Dashboard** (`src/pages/portal/Dashboard.tsx`)
   Mirror the Bookings layout so non-member spa clients are prompted as soon as they log in.

The banner self-hides (`if (!pending.length) return null;`), so it's invisible when there's nothing to review.

## Out of scope (not doing unless you ask)

- Public/tokenized review link for spa (same answer as class reviews — would be a new feature).
- Post-appointment email with a "Leave a review" button.
- Any change to the review dialog itself, names (already first + last initial), or admin moderation.

## Verification

After implementation: log in as a member with a completed spa appointment → the gold "Spa reflection" banner appears on Dashboard and My Bookings → clicking opens the existing rating dialog → submitting hides the banner.
