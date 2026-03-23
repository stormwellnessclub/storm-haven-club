

# Admin & Public Class Schedule Views — Current State & Improvement Plan

## Current State Summary

### Public Website (`/classes`)
- **Class catalog only** — shows class type cards with name, description, duration, capacity, ratings, images
- No times or dates — just a directory of class offerings
- "Book Class" button navigates to `/schedule`

### Public Website (`/schedule`)
- **Live weekly timetable** — day-by-day list view (Sun–Sat) with times, instructor, room, spots left
- Week navigation (prev/next), category filters
- Book/Join Waitlist buttons for logged-in users; sign-in redirect for guests
- Heated/Cool badges, room info

### Member Portal
- No dedicated schedule page — members use the same public `/schedule` page
- Dashboard has quick action buttons linking to `/schedule`

### Admin — Class Schedules (`/admin/class-schedules`)
- **Template management** — recurring weekly schedule patterns (not actual dated sessions)
- Two views: **Table** (list of all templates) and **Calendar** (Google Calendar-style weekly grid showing templates by day/time)
- The calendar view (`WeeklyCalendarView`) shows schedule blocks color-coded by category, with conflict detection, click-to-edit, and hide-inactive toggle

### Admin — Today's Classes (`/admin/classes`)
- Shows only **today's** generated sessions in a card/list format
- No calendar view for upcoming sessions across multiple days

---

## Plan: Add Admin Sessions Calendar View

Since you want **both** the existing template calendar AND a real sessions calendar with actual dates, here's the plan:

### 1. Create `AdminSessionsCalendar` component
A new component similar to `WeeklyCalendarView` but showing **actual generated sessions** (from `class_sessions` table) for a specific week, with real dates.

- Week navigation (prev/next arrows) with date range display
- Same Google Calendar-style grid layout as the template view (time axis on left, days as columns)
- Each session block shows: class name, time, instructor, room, enrollment count (e.g. "4/8"), status badges (cancelled, hidden)
- Color-coded by category (same color scheme as template view)
- Click a session to see details or take actions (cancel, edit enrollment, etc.)
- Filter: category, show/hide cancelled sessions

### 2. Add to Admin Classes page (`/admin/classes`)
- Add a view toggle: **"Today"** (existing card view) vs **"Week Calendar"** (new sessions calendar)
- The week calendar will replace the static "today only" limitation, letting you see actual sessions across any week

### 3. Files to create/modify
| File | Change |
|------|--------|
| `src/components/admin/AdminSessionsCalendar.tsx` | **New** — weekly calendar showing real dated sessions |
| `src/pages/admin/Classes.tsx` | Add view toggle between Today cards and Week Calendar |

### 4. No changes to public pages
The public `/schedule` and `/classes` pages stay as-is — the list view is appropriate for public users (mobile-friendly, scannable). The calendar grid view is an admin tool for operational overview.

