# PT Passes — Group by Customer

## Problem
The admin PT Passes page (`/admin/personal-training/passes`) currently lists every pass as its own row. When Faten buys 5 single Reformer passes, that's 5 rows for one person. This won't scale.

## Changes

### 1. Admin page: customer-first list
Rework `src/pages/admin/PersonalTrainingPasses.tsx` so the left column shows **one row per customer** instead of one row per pass.

Each customer row shows:
- Name + Member/Non-member badge
- Email (small, muted)
- Aggregate: total sessions remaining across all their passes (e.g. "12 sessions left · 3 packs")
- Soonest upcoming expiration date, red if within 14 days
- Format breakdown chips (e.g. "1-on-1 · Reformer · Cycling")

Search box keeps working: filter customers by name / email / pack name.
Format and status filters keep working and apply to the underlying passes before grouping (so an "Active" filter rolls up only active packs).

### 2. Right pane: customer detail
Clicking a customer opens the right pane showing **all of that customer's passes** (newest first), each with the existing edit controls collapsed into compact cards:
- Pack name, format, sessions x/y, activation, expiration
- "Edit" expands inline to the current activation / expiration / sessions-remaining editor + Save
- Existing actions per pass: Deduct one session, Status dropdown
- A "Sell another pack" button at the top of the pane that opens `SellPTDialog` pre-filled with this customer

This keeps Faten's 5 single passes as a single line in the master list, expandable to 5 editable cards on the right.

### 3. Member / non-member portal
Already covered. `/portal/passes` mounts `MyPTPassesSection`, which is the only passes route in the app and is used by both members and non-members. No code change needed — confirm it renders Faten's passes after the next purchase.

## Out of scope
- No DB / RLS / edge function changes.
- No change to `SellPTDialog` other than passing the preset customer when opened from a customer row.
- No change to the portal — already wired.

## Files touched
- `src/pages/admin/PersonalTrainingPasses.tsx` (rewrite list + detail pane)
