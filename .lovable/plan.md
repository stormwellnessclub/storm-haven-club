## Goal

Two related fixes for the existing milestone/achievement system:

1. **Member-side visibility** — milestones aren't rendering in the Member portal Dashboard (only the non-member Portal Dashboard has `ClassMilestonesCard`, and `useUserClassTotal` only counts the logged-in `user_id`, missing member-id bookings reliably).
2. **Roster visibility** — admin `ClassRoster` shows no "first class" or total-class count, and the kiosk `KioskClassRoster` has the UI fields (`is_first_in_type`, `total_classes`, `milestone_hit`, `next_milestone`, `prior_total`) but nothing in the codebase populates them, so the badges never appear.

## Changes

### 1. Member Dashboard milestone card
- Add `<ClassMilestonesCard />` to `src/pages/member/Dashboard.tsx` (top of the main column, next to the existing achievement summary).
- Pass through the member's `user_id` explicitly.

### 2. Shared roster-stats resolver
- New `src/hooks/useRosterClassStats.ts` (or extend `useRosterIdentity`) that takes the resolved attendees + current `class_type_id` + `session_date` and returns, per attendee, all five fields the kiosk UI expects:
  - `total_classes` (completed bookings prior to today, both `user_id` and `member_id` matched)
  - `prior_total` (total_classes minus today's confirmed booking, used for "X away from" math)
  - `is_first_in_type` (no completed booking of the same `class_type_id` before today)
  - `milestone_hit` (today's class would tip them over a lifetime milestone: 10/25/50/100/250/500)
  - `next_milestone` (smallest milestone above `prior_total`)
- Source data: `class_bookings` filtered by `status in ('confirmed','completed')` and `session_date < today`, grouped per attendee. One batched query keyed on the set of `user_id`s and `member_id`s in the roster.

### 3. Admin ClassRoster badges
- In `src/pages/admin/ClassRoster.tsx`, call the new hook for the current session's resolved attendees and render compact inline badges next to each name:
  - "1st [class type]" pill when `is_first_in_type`
  - Trophy + total-classes count when `total_classes > 0`
  - "🎉 Nth class today!" when `milestone_hit`
  - Subtle "X away from N" hint when within 2 of a milestone
- Same visual language as the existing `KioskClassRoster` chips so admin and front desk match.

### 4. Wire the kiosk roster
- Whatever component(s) currently render `KioskClassRoster` (front desk / kiosk classes page) should pass the new stats through. Today they pass attendees without the milestone fields, so the JSX guards (`typeof entry.total_classes === "number"`) short-circuit and nothing shows. After this change, the same resolver feeds both admin and kiosk.

### 5. `ClassMilestonesCard` count fix
- `useUserClassTotal` currently does two queries (direct `user_id` + `member_id`) but can double-count when a booking has both columns set. Switch to a single query using `.or('user_id.eq.{uid},member_id.eq.{member_id}')` with `count: 'exact'` to get an accurate lifetime total.

## Out of scope
- No changes to the `user_class_achievements` table or the achievement-celebration overlays.
- No changes to charging/waitlist flows from the previous turn.
