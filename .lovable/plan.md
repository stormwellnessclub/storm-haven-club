## Plan: Fix class scheduling so one-off and date-range classes are obvious and work

1. **Expose the correct scheduling page clearly**
   - Add **Class Schedules** as its own sidebar item under Classes, so it is not hidden behind “Class Management.”
   - Rename the page copy from “Manage recurring weekly class schedules” to wording that includes **ongoing, date-range, and one-time classes**.

2. **Make the Add Class flow unmistakable**
   - Change the primary button from **Add Schedule** to **Add Class to Schedule**.
   - Keep the three schedule options at the top, but make them more direct:
     - **Ongoing weekly**
     - **Date range** — example: Aug 6 through Aug 20
     - **One-off class** — one date only
   - When **Date range** is selected, show start/end dates directly under the day selector.
   - When **One-off class** is selected, show only the class date, and automatically determine the weekday.

3. **Fix the confusing “all ongoing” display**
   - Update the table/calendar labels so date-range and one-off entries visibly show their type and exact dates.
   - Add a **Type** column in the schedule table: Ongoing / Date range / One-off.
   - Update the card title from “Weekly Schedule” to **Schedule Rules** so date-range and one-off classes don’t appear mislabeled as ongoing.

4. **Ensure generated rosters appear for future date ranges**
   - When saving a class dated in the future, run session generation starting from that class’s start date, not only from today.
   - This prevents an Aug 6–Aug 20 class from saving but not producing visible roster buttons.

5. **Add direct navigation after saving**
   - After creating a one-off or date-range class, show a success message with **Open roster** if a session was generated.
   - Keep the existing generated roster buttons in the table for quick access.

## Technical notes
- Frontend changes are mainly in `src/pages/admin/ClassSchedules.tsx` and `src/components/admin/AdminSidebar.tsx`.
- No new database table is needed because `class_schedules` already has `is_one_time`, `effective_from`, and `effective_until` fields.
- I will only adjust scheduling UI/navigation and generation behavior for this issue.