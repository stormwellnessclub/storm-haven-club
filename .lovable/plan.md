## Problem

When a non-member (someone with a class pass / non-member profile, not a full member) checks into a class, the Front Desk "Today's Attendance" list still shows them as **"Walk-in"**. Same issue for spa (shows "Unknown"). The roster view (`useRosterIdentity.ts`) already resolves non-members correctly — but the attendance/search hooks were never updated to do the same fallback.

## Root cause

`src/hooks/useUnifiedAttendance.ts` (lines 84–94, 187–218) and `src/hooks/useUnifiedCheckInSearch.ts` (lines 109–147) query `class_bookings` / `spa_appointments` and only join the `members` table. If `members` is null they fall straight through to `walk_in_name || "Walk-in"` (or `"Unknown"` for spa) — they never look up `non_member_profiles` or `profiles` by `user_id`.

## Fix

Apply the same identity-resolution chain used in `useRosterIdentity.ts` — members → non_member_profiles → profiles → walk-in fields — to both hooks, and surface the identity type so a badge can be shown.

### 1. `src/hooks/useUnifiedAttendance.ts`
- Add `user_id` to the `class_bookings` and `spa_appointments` selects.
- After the initial queries, collect all `user_id`s that lack a member join, and fetch `non_member_profiles` and `profiles` in parallel (single batched query each, like `useRosterIdentity`).
- Build a resolver returning `{ name, subtitle, kind: "member" | "non_member" | "account" | "walk_in", navigateTo }`.
- Extend `AttendanceEntry` with an optional `identityKind` field.
- Update the class + spa forEach loops to use the resolver instead of the direct `walk_in_name || "Walk-in"` / `"Unknown"` fallbacks.

### 2. `src/hooks/useUnifiedCheckInSearch.ts`
- Same select changes + same batched non-member/profile lookup.
- Use the resolved name for both the display and the `q` filter (so searching a non-member by name actually matches).
- Include a `kind` field on `SearchResult.data` so the UI can label them.

### 3. `src/pages/FrontDesk.tsx` (display only)
- Read the new `identityKind` on class/spa attendance rows and render the existing badge component: "Non-Member • Class Attendee", "Guest • Class Attendee", "Walk-In" only when there truly is no linked user.
- Same for spa: "Non-Member • Spa" or "Guest • Spa" instead of "Unknown".

No DB/RPC changes — the kiosk RPCs already record `user_id` on the booking; the client just wasn't resolving it in these two hooks.

## Out of scope

Roster (already fixed), kiosk RPC identity return payload (already correct), member/guest branches (already correct).