## Problem

In **Admin → Class Schedules → Add Schedule**, the "One-off class" mode currently uses the browser's native `<input type="date">`. On many browsers/devices this renders as a plain text field or a minimal picker that only exposes day-of-week columns without a full month grid — making it hard to see actual dates when planning one-off sessions. The same issue affects the **Date range** mode's Start/End inputs.

## Fix

Swap the native date `<Input>`s for the shadcn **Calendar popover** date picker (already used elsewhere in the app) so admins see a real month grid with weekday headers *and* numbered dates, month navigation, and today highlighted.

Scope of change is limited to `src/pages/admin/ClassSchedules.tsx`:

1. **One-off class → "Date" field**
   - Replace the `<Input type="date" id="oneTimeDate">` with a `Popover` + `Calendar` (mode="single") trigger button showing the formatted date (e.g. "Tue, Aug 12, 2026") or a "Pick a date" placeholder.
   - Bind `selected` / `onSelect` to the existing `oneTimeDate` state (converting between `Date` and `yyyy-MM-dd` strings so no downstream logic changes).
   - Disable past dates in the calendar.

2. **Date range → Start Date / End Date fields**
   - Apply the same Calendar popover pattern to both inputs.
   - Constrain End Date's calendar to dates on/after Start Date.

3. Keep all existing state variables, validation, and submission logic unchanged — only the input presentation swaps.

No changes to the database, RPCs, or other pages.

## Technical Notes

- Use existing imports: `Calendar` from `@/components/ui/calendar`, `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover`, `format` and `parse` from `date-fns` (already imported).
- Add `pointer-events-auto` on the Calendar inside the dialog per project convention.
- Convert to/from `yyyy-MM-dd` with `format(date, 'yyyy-MM-dd')` and `parse(str, 'yyyy-MM-dd', new Date())` to avoid timezone drift.
