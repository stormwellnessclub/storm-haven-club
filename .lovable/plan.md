

## Improve Class Pass Visibility in Member Portal

### The Problem
The member dashboard shows "Class Passes: 1" (just a count) with no detail about what kind of pass it is or how many classes remain. Members can't quickly see their pass info without navigating to the Credits page.

### Changes

**File: `src/pages/member/Dashboard.tsx` (lines 275-295)**

Replace the bare number with a detailed summary that shows:
- Each pass listed by type (e.g., "Pilates & Cycling -- 10-Pack") with classes remaining
- A small progress bar per pass
- Total classes remaining across all passes
- If no passes, show a "Buy Passes" link

Example of what the card will look like:

```
CLASS PASSES
-----------------------------
Pilates & Cycling -- 10-Pack
  8 of 10 remaining  [████████░░]
  Expires Mar 15, 2026

Aerobics -- Single
  1 of 1 remaining   [██████████]
  Expires Apr 2, 2026
-----------------------------
[Buy More Passes]
```

If only one pass exists, it shows that single pass inline. If multiple, they stack vertically. The card links to `/member/credits` for full details.

**File: `src/pages/member/Credits.tsx` (lines 317-378)**

Add two links below the Class Passes section header:
- "View Booking History" -- links to `/member/bookings`
- "Book a Class" -- links to `/schedule`

This lets members track usage and book upcoming classes directly from their passes view.

**File: `src/pages/member/Credits.tsx` (PassCard component, lines 549-585)**

Add a "Book a Class" button inside each pass card so members can go straight to the schedule from their pass.

### Technical Details

| File | Lines | Change |
|------|-------|--------|
| `src/pages/member/Dashboard.tsx` | 275-295 | Replace count-only card with per-pass breakdown showing type, remaining classes, progress bar, and expiry |
| `src/pages/member/Credits.tsx` | 317-327 | Add "View Booking History" and "Book a Class" action links next to "Buy More Passes" |
| `src/pages/member/Credits.tsx` | 549-585 | Add "Book a Class" link button inside PassCard component |

No database changes needed. No new files. Uses existing `useUserCredits` hook data and `getCategoryDisplayName` from `classCategories.ts`.
