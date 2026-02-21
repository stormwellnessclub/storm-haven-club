

## Admin Soft Launch Class Management

### The Problem
The "Soft Launch Schedule" tab in admin just shows the same read-only timetable that members see. There is zero visibility into who booked each class, no attendance tracking, and no way to add or remove people. All the roster/attendance management tools exist in the "Full Schedule" tab but are not connected to soft-launch classes.

### The Solution
Replace the soft-launch tab with a proper class management interface that queries actual bookings from `class_sessions` created during the soft-launch period (Feb 20 - Mar 18, 2026). Each class shows enrollment count, and clicking it opens a roster with check-in, remove, and add-member capabilities.

### What You Will See

```text
SOFT LAUNCH CLASS MANAGEMENT
[< Prev Day]  Friday, Feb 21, 2026  [Next Day >]

+------------------------------------------+
| Signature Flow          8:00 PM          |
| Instructor: Duha   Room: Reformer Studio |
| Enrolled: 3/8           Status: Upcoming |
| [View Roster]           [Cancel Class]   |
+------------------------------------------+
| Reformer Flow           9:00 PM          |
| Instructor: Duha   Room: Reformer Studio |
| Enrolled: 1/8           Status: Upcoming |
| [View Roster]           [Cancel Class]   |
+------------------------------------------+

--- Roster Dialog (when "View Roster" clicked) ---
+---------------------------------------------------+
| Signature Flow - Feb 21 at 8:00 PM                |
| 3 members registered                              |
|                                                   |
| [+ Add Member]                                    |
|                                                   |
| Name             Status        Action             |
| ------------------------------------------------- |
| Jane Smith       Registered    [Check In] [Remove]|
| Mike Johnson     Checked In    --                  |
| Sarah Lee        Registered    [Check In] [Remove]|
+---------------------------------------------------+
```

### Changes

**File: `src/pages/admin/Classes.tsx`**

Replace the soft-launch tab content (`<TempClassSchedule readOnly />`) with a new admin management view:

1. Add a date picker that navigates day-by-day within the soft-launch window (Feb 20 - Mar 18)
2. Query `class_sessions` for the selected date, joined with `class_types` and `instructors`
3. Display each session as a card showing class name, time, enrollment count, and status
4. Each card has "View Roster" and "Cancel Class" buttons (reusing the existing roster dialog and cancel dialog already built on lines 402-518)
5. Add a roster enhancement: "Add Member" button that lets admin search and add a member to the class
6. Add a "Remove" button next to each booking in the roster to cancel a member's booking

**No new files needed.** The existing roster dialog, check-in mutation, and cancel mutation in `Classes.tsx` already handle the core operations. The change is connecting them to soft-launch session data instead of only showing the static timetable.

### Technical Details

| Change | Detail |
|--------|--------|
| New query in soft-launch tab | Fetch `class_sessions` for selected date within Feb 20 - Mar 18 range, with `class_types` and `instructors` joins |
| Day navigation | State variable `selectedDate` with prev/next buttons, clamped to soft-launch range |
| Session cards | Reuse the same card layout from the full-schedule tab (lines 278-397) |
| Roster dialog | Already exists (lines 402-475) -- reuse as-is, just triggered from soft-launch cards too |
| Add Member to class | New small section in roster dialog: search input that queries `members` table, then inserts a `class_bookings` row with `status: 'confirmed'` |
| Remove from class | New button per booking row that updates `class_bookings.status` to `'cancelled'` and decrements `class_sessions.current_enrollment` |
| Cancel class | Already exists (lines 478-518) -- reuse as-is |
| Keep static timetable | Move the existing `TempClassSchedule readOnly` below the management cards as a "Reference Schedule" collapsible section so admin can still see the planned timetable |

