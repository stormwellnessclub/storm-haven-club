# Fix check-in history: show full history, accurate totals

## Problem
Member check-in views cap at the 50 most recent rows, which is what makes the history look like it "resets every month" and stops at 50. Once a member has 50+ visits, older months drop off the list, and the "This Month" tile (which counts within that 50-row window) starts dropping earlier visits as new ones push older ones out.

Two spots cause this:

1. `src/hooks/useCheckInHistory.ts` — `useCheckInHistory(memberId?, limit = 50)` and the underlying query uses `.limit(limit)`. Used by `src/pages/member/CheckInHistory.tsx`.
2. `src/components/admin/MemberDetailSheet.tsx` → `MemberVisitHistory` — query uses `.limit(50)`, and both "Total Visits" and "This Month" derive from that capped array.

No data is actually deleted — the underlying `check_ins` rows are intact. This is a display-layer bug only.

## Changes

### 1. `src/hooks/useCheckInHistory.ts`
- Default `limit` to `undefined` (return full history).
- Page through results in 1000-row batches (same pattern already used in `src/pages/admin/CheckInHistory.tsx`) so we don't hit PostgREST's 1000-row implicit cap.
- Keep the optional `limit` arg so any caller that wants a small recent list still can.

### 2. `src/pages/member/CheckInHistory.tsx`
- No API change needed — it already calls `useCheckInHistory()` with no args. After the hook change it will show the complete history. The "Total Check-ins" stat (`checkIns?.length`) becomes the real lifetime total.

### 3. `src/components/admin/MemberDetailSheet.tsx` → `MemberVisitHistory`
- Replace the single `.limit(50)` query with:
  - A `head: true, count: 'exact'` query filtered by `member_id` for the **Total Visits** tile (DB-side count, no row cap).
  - A second `head: true, count: 'exact'` query filtered by `member_id` AND `checked_in_at >= startOfMonth(now)` for the **This Month** tile (correct regardless of total visit count).
  - A paginated fetch (1000-row batches) of the full list for the scrollable timeline, ordered by `checked_in_at desc`. The list is already inside a `max-h-[400px] overflow-y-auto` container, so rendering the full history is fine.
- Remove the client-side `thisMonth` `useMemo` that filtered the capped array.

## Out of scope
- No schema changes, no migrations, no backfill — historical rows are already in `check_ins`.
- Admin `/admin/check-in-history` page already paginates correctly; no change there.
- Health Score / Dashboard counters use their own RPCs and are unaffected.
- No change to write paths (kiosk/front-desk check-in remain as-is).

## Verification
- Open a member with >50 lifetime visits in `MemberDetailSheet` → Visits tab: Total Visits matches the DB count, This Month matches a manual count for the current calendar month, timeline scrolls through every visit.
- `/member/check-in-history` for the same member shows every historical check-in, not just the latest 50.
- Run `tsgo` to confirm types still compile.
