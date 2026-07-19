## Plan

I verified the newest class schedules are being saved and sessions are being generated in the database. The visibility problem is likely the admin roster/schedule experience: **Today's Classes** defaults to today only, the public/member schedule only shows the 4-week booking window, and the class schedule manager does not clearly show the generated session dates/roster links after a schedule is added.

### What I will change

1. **Make schedule creation show exactly where the class went**
   - After adding or editing a schedule, show a clear success message with the next generated class date/time.
   - Include an action to open that class roster directly.

2. **Add “generated sessions” visibility inside Class Schedule Management**
   - For each schedule row/card, show its upcoming generated sessions within the booking window.
   - Add quick links like **View roster** for each generated class.
   - This will cover recurring, date-range, and one-time classes.

3. **Improve the admin Classes page so new classes are easier to find**
   - Add an **Upcoming** view/list so staff are not stuck on “today” only.
   - Keep Day View intact, but make future added classes discoverable without manually clicking dates one by one.

4. **Harden session generation for one-time and date-range classes**
   - Ensure one-time/date-range schedules generate sessions immediately when their dates fall inside the visible booking window.
   - Keep the public/member booking limit at 4 weeks, per your earlier request.

5. **Verify with real data**
   - Confirm the most recently added classes appear in admin schedule management.
   - Confirm their roster links open the correct class roster.
   - Confirm public/member schedule still respects the 4-week booking window.