

## Fix Hidden/Cancelled Classes and Past Day Visibility

### Problem

There are three bugs in how hidden and cancelled classes interact with the schedule views:

1. **Hidden classes still show as bookable to customers**: When you mark a class as "Remove from schedule" (silent cancel), the enrollment query correctly filters it out. But the hardcoded schedule still lists the class, and since no matching DB record is found, it defaults to showing it as a normal bookable class with 8 spots available. This is the opposite of what should happen.

2. **Admin loses history of hidden classes**: The admin management view also filters out hidden sessions, so once a class is silently removed, admins can no longer see it or its attendance data.

3. **Admin reference timetable hides past days**: The collapsible "Reference: Planned Timetable" in the admin view doesn't pass `showHistory={true}`, so admins can't navigate to past weeks.

### Solution

#### 1. Fix the customer-facing enrollment query (TempClassSchedule.tsx)

- Remove the `is_hidden: false` filter from the enrollment query so we fetch ALL sessions (including hidden and cancelled ones)
- In the rendering logic, skip classes where the DB record is either `is_hidden: true` OR `is_cancelled: true` -- customers should not see these at all
- Update `getEnrollmentForSlot` to also return `isHidden` so the rendering can check both flags

This ensures that when you silently remove a class, it truly disappears from the customer view instead of reappearing as a default bookable class.

#### 2. Fix the admin view to preserve history (SoftLaunchClassManagement.tsx)

- Remove the line that filters out hidden sessions (line 94: `if (match?.is_hidden) return null`)
- Instead, show hidden sessions with a distinct visual indicator (e.g., "Removed" badge) so admins can see attendance and booking history
- Add a "Restore" button for hidden sessions so admins can un-hide them if needed

#### 3. Pass showHistory to admin reference schedule (SoftLaunchClassManagement.tsx)

- Change line 254 from `<TempClassSchedule readOnly />` to `<TempClassSchedule readOnly showHistory />`
- This lets admins navigate to past weeks in the reference timetable

### Technical Details

**File: `src/components/booking/TempClassSchedule.tsx`**

- Remove `.eq("is_hidden", false)` from the enrollment query (line 150) so hidden sessions are fetched
- Add `isHidden` to the return type of `getEnrollmentForSlot`
- In the class rendering loop (lines 220-253), add a check: if `isCancelled || isHidden`, skip rendering entirely for the customer view (when `!showHistory`)
- For the admin/history view (`showHistory=true`), show cancelled/hidden classes with appropriate badges

**File: `src/components/admin/SoftLaunchClassManagement.tsx`**

- Remove line 94 (`if (match?.is_hidden) return null`) so hidden sessions appear in the admin list
- Add an `isHidden` flag to the `ScheduleSlot` interface
- Show hidden sessions with a "Removed" badge and dimmed styling, with a "Restore" action button
- Add a restore mutation that sets `is_cancelled: false, is_hidden: false` on the session
- Change the reference schedule on line 254 to include `showHistory`: `<TempClassSchedule readOnly showHistory />`

