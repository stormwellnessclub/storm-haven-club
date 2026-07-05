## Problem

On the kiosk check-in screens, non-member class attendees and guest attendees fall through to a generic "Walk-in"/"Unknown" label because the resolver only joins the `members` table. Their real name (already in `non_member_profiles`, `profiles`, or `walk_in_*` / `guest_passes` fields) is lost, and there's no badge telling the front desk what kind of visitor they are.

## Goal

On every kiosk surface (Reception "Today's Attendance", Reception search, Classes kiosk, Spa kiosk), each visitor row shows:

- **Real name**, resolved through the full fallback chain
- **Type badge** next to the name, specific to how they entered:
  - `Member` — from `members` (no badge change; existing)
  - `Guest Pass` — class booking backed by a guest pass, or a `guest_passes` row
  - `Class Pass` — non-member with a `class_passes` pass_id or purchased single class
  - `Non-Member` — user_id resolves via `non_member_profiles` / `profiles`, no pass context
  - `Walk-In` — only `walk_in_*` fields, no user_id (front-desk-added stranger)
  - `Spa Guest` — spa appointment with user_id but no members row

No badge change to the "Member" chip that already renders.

## Scope

Kiosk pages only (per user answer). No admin/CheckInHistory or Class Roster changes in this pass — those already show richer type info.

## Changes

### 1. New helper: `src/lib/checkInIdentity.ts`
Pure functions used by both attendance and search hooks:

- `resolveClassBookingIdentity(row, nmMap, profMap)` → `{ name, badge: 'Member'|'Class Pass'|'Guest Pass'|'Non-Member'|'Walk-In', navigateTo? }`
  - If `row.member` → Member.
  - Else if `row.user_id` and present in `nmMap` → Non-Member (or `Class Pass` when `row.pass_id` is set).
  - Else if `row.user_id` and present in `profMap` → Non-Member.
  - Else if `row.walk_in_name` and `row.payment_method === 'guest_pass'` → Guest Pass.
  - Else if `row.walk_in_name` → Walk-In.
  - Else → Unknown.
- `resolveSpaIdentity(row, nmMap, profMap)` → same shape, badge domain `'Member'|'Spa Guest'|'Non-Member'|'Unknown'`.

### 2. `src/hooks/useUnifiedAttendance.ts`
- Extend the class_bookings SELECT to include `user_id, pass_id, payment_method, walk_in_email, walk_in_phone` (currently only `walk_in_name`).
- Extend the spa_appointments SELECT to include `user_id`.
- After the primary Promise.allSettled, collect the missing `user_id`s from class + spa results and issue two parallel lookups: `non_member_profiles` (user_id, first_name, last_name) and `profiles` (user_id, first_name, last_name). Wrap in try/catch so failure downgrades gracefully to the current fallback.
- Add optional `badge?: string` to `AttendanceEntry`.
- Replace the two inline `cb.member ? ... : cb.walk_in_name || "Walk-in"` blocks with `resolveClassBookingIdentity` / `resolveSpaIdentity`, and set `entry.badge` from the result.
- Guest_passes loop already sets `name = g.guest_name`; add `badge: 'Guest Pass'`.

### 3. `src/hooks/useUnifiedCheckInSearch.ts`
Same treatment as #2: extend selects, add profile lookups (only when class or spa results contain unresolved user_ids), add `badge` to `UnifiedSearchResult`, and use the same helper. The current name-substring filter (`memberName.toLowerCase().includes(q)`) keeps working — it filters on the resolved name.

### 4. Kiosk UI badges
Render a small `Badge` next to the visitor name on the three kiosk pages. Same style everywhere so it reads consistently.

- **`src/pages/kiosk/Reception.tsx`** — attendance list rows + search-result rows. Show `entry.badge` (skip when badge is `Member` since that's obvious from context) using shadcn `Badge variant="secondary"` for pass/non-member, `variant="outline"` for walk-in/guest.
- **`src/pages/kiosk/Classes.tsx`** — the class attendee list already uses `resolveRosterIdentities` (which returns `type`). Map `type` → the same wording (`pass_holder` → "Class Pass" or "Non-Member" based on presence of a pass, `walk_in` → "Walk-In", `account` → "Non-Member"). Add badge next to the name.
- **`src/pages/kiosk/Spa.tsx`** — mirror the pattern for spa appointment rows.

## Out of scope

- Admin `CheckInHistory` (already shows type info; user said kiosk only).
- Class Roster (already redesigned in prior change).
- Renaming the underlying booking `type` enum or DB columns.
- Any change to how bookings are created or how guest passes attach to class bookings.

## Verification

1. Book a class as a non-member (class pass) → check them in from the class kiosk → Reception "Today's Attendance" shows their real name with a "Class Pass" badge (not "Walk-in").
2. Add a walk-in via the front desk (walk_in_name only) → shows their name with "Walk-In" badge.
3. Use a guest pass to enter → shows the guest's name with a "Guest Pass" badge.
4. Book a spa service as a non-member → check them in on the spa kiosk → Reception shows the name with "Spa Guest" or "Non-Member" badge.
5. Search on the Reception kiosk for any of the above by name → they surface with the same badge.
