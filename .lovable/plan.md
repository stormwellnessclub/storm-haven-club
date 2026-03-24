
Fix admin class management so staff can always see who is booked, open a proper roster, add/remove/check in people, and manage classes without tiny unusable blocks.

What I found
- `src/pages/admin/Classes.tsx` still uses a small modal (`DialogContent max-w-2xl`) as the main roster UI. That modal only shows a stripped-down booking list plus check-in.
- The real management screen already exists in `src/pages/admin/ClassRoster.tsx` and includes add-to-class, walk-ins, payment method selection, removing bookings, waitlist handling, and package selling.
- Nothing in admin class management links to that full roster page. So the powerful workflow exists, but staff are stuck in the limited one.
- The limited roster query in `Classes.tsx` only joins `members`. If a booking belongs to a pass holder/profile/walk-in without a `members` row, admin sees the count but not the person. That matches the “1 booked but can’t see who” problem.
- `src/components/admin/AdminSessionsCalendar.tsx` is still a compact week grid. Even with overlap handling, dense days produce tiny blocks that are fine for overview but bad for real front-desk operations.

Plan
1. Make one roster system the source of truth
- Stop using the small `Classes.tsx` modal as the primary management UI.
- Use `ClassRoster.tsx` as the main class-management surface for any session.
- Route both day-list actions and calendar clicks to `/admin/class-roster/:sessionId`.

2. Fix attendee visibility everywhere
- Reuse the richer booking lookup pattern from `ClassRoster.tsx`.
- Always resolve attendee identity in this order:
  - member name/photo from `members`
  - fallback name/email from `profiles`
  - walk-in name if present
- Show clear attendee labels so staff never see “1 booked” without a person attached.

3. Replace the limited class actions with real admin actions
- In `Classes.tsx`, add obvious buttons on each class row/card:
  - Manage Roster
  - Add Person
  - View/Check In Attendees
  - Cancel Class
- In calendar view, clicking a class should open the full roster page, not a tiny modal.
- Add quick attendee preview on class cards/calendar blocks when possible (first names + “+N more”).

4. Make the calendar usable for operations, not just overview
- Upgrade `AdminSessionsCalendar.tsx` to support:
  - a single-day operational timeline
  - a week overview
  - larger, more readable session blocks
  - clearer labels for class, room, and booked/max
- Keep week view for overview, but make day management much easier.

5. Remove roster logic drift
- Extract shared admin roster fetching/formatting into one hook/helper.
- Use that shared logic for:
  - full roster page
  - attendee previews
  - any quick-view UI
- This prevents the current mismatch where counts and identities disagree.

6. Keep and expose the tools staff actually need
- Preserve the existing capabilities already in `ClassRoster.tsx`:
  - add member / pass holder / walk-in
  - choose payment method
  - sell package
  - remove from class with refund/credit restore
  - manage waitlist
- Make these reachable directly from class management instead of hidden on an unlinked page.

Files to change
- `src/pages/admin/Classes.tsx`
- `src/pages/admin/ClassRoster.tsx`
- `src/components/admin/AdminSessionsCalendar.tsx`
- new shared hook/helper for admin roster data

Result
- If a class shows “1 booked,” staff will immediately see who it is.
- Clicking a class opens a full management screen, not a crippled mini modal.
- Staff can add people, remove them, manage waitlist, and handle payment from the actual class workflow.
- The calendar becomes usable for a real business instead of tiny unreadable squares.
