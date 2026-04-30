## Goal

Add a premium, motivating banner that prompts members and non-members to leave reviews for past classes they haven't yet reviewed. The banner appears on both bookings pages and only shows when there's at least one unreviewed past class.

## Where it appears

1. `src/pages/member/Bookings.tsx` — for members, above the tabs.
2. `src/pages/portal/Bookings.tsx` — for non-members, above the tabs.

Both pages already load `pastBookings` (or `past`) and `myReviews` — so we can compute "unreviewed past bookings" with no extra queries.

## What it looks like (preview)

A warm gradient banner using the existing brand tokens (`--gradient-gold`, `--shadow-gold`, serif heading). On desktop it's a single horizontal card; on mobile it stacks. It hides itself if there's nothing to review.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ✦  Your voice shapes the Storm experience                           │
│                                                                       │
│     You have 3 classes waiting for your reflection. Share what       │
│     moved you — every review elevates the next member's practice.    │
│                                                                       │
│                                       [ ✦ Leave a Review  → ]        │
└──────────────────────────────────────────────────────────────────────┘
```

Visual specs:
- Background: `bg-[image:var(--gradient-gold)]` with subtle inner shadow.
- Subtle decorative sparkle icon (Lucide `Sparkles`) in the corner at low opacity.
- Headline in serif font (`font-serif`), tracked tight, on the warm cream foreground.
- Body in regular sans, slightly muted.
- Button: solid charcoal (`bg-foreground text-background`) with gold ring on hover — premium, restrained, not flashy.
- Single rounded corner radius matching cards (`rounded-md`).
- Dismissible? No — it auto-disappears once all past classes are reviewed (or the user has no past bookings).

Copy options I'll use (premium, non-cheesy):

- Headline: **"Your voice shapes the Storm experience"**
- Subhead: 
  - 1 unreviewed: *"One class is waiting for your reflection. Share what moved you — your words guide the next member's practice."*
  - Multiple: *"You have {n} classes waiting for your reflection. Share what moved you — every review elevates the next member's practice."*
- CTA: **"Leave a Review"** (opens the most recent unreviewed class in the existing `ReviewDialog`).

## Behavior

- Compute `unreviewedPast = past.filter(b => b.status !== 'cancelled' && !reviewByBooking[b.id])`.
- If `unreviewedPast.length === 0` → render nothing.
- CTA button:
  - On member page: opens `ReviewDialog` for the most recent unreviewed class via the existing `setReviewTarget` state.
  - On portal page: same, via existing `setReviewTarget`.
- Counter chip top-right shows `{n} pending` when n > 1.

## Implementation

New shared component `src/components/reviews/LeaveReviewBanner.tsx`:

```tsx
interface Props {
  count: number;
  onLeaveReview: () => void; // opens dialog for first unreviewed booking
}
```

- Pure presentation; no data fetching inside.
- Uses semantic tokens only (no hardcoded colors).

Wire it into both bookings pages:
- Compute `unreviewedPast` from existing data.
- Pass `count={unreviewedPast.length}` and an `onLeaveReview` handler that calls `setReviewTarget(...)` with the first unreviewed booking's data.

## Out of scope

- No new RPC, no DB change, no new query — fully derived from data already loaded.
- No banner on the public/anonymous class pages.
- No email/notification reminder — banner is in-app only.

## Files touched

- New: `src/components/reviews/LeaveReviewBanner.tsx`
- Edited: `src/pages/member/Bookings.tsx`
- Edited: `src/pages/portal/Bookings.tsx`
