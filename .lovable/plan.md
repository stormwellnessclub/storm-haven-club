

# Add Temporary Class Schedule Tab

## Overview
Add a new "Temp Class Schedule" tab to the Schedule page that displays a hardcoded/static temporary schedule. This will sit alongside the existing dynamic schedule as a separate tab. We'll also add instructor "Duha" to the database.

## Steps

### 1. Add Instructor "Duha" to the Database
- Insert a new instructor record with `first_name: 'Duha'` into the `instructors` table via a database migration.
- You'll provide the last name and any other details if needed.

### 2. Wrap the Schedule Page in Tabs
- Add Radix UI `Tabs` component to `src/pages/Schedule.tsx` with two tabs:
  - **Class Schedule** (default) -- contains the existing full schedule with all filters, week navigation, calendar, etc.
  - **Temp Class Schedule** -- a new static tab for the temporary schedule

### 3. Create a `TempClassSchedule` Component
- New file: `src/components/booking/TempClassSchedule.tsx`
- Displays a clean, static weekly table showing the temporary Reformer Pilates schedule
- Instructor "Duha" will be displayed on each entry
- Styled consistently with the rest of the site (card-based or table layout)
- No booking functionality -- display only (since soft launch mode is active)
- Once you provide the actual schedule times/days, I'll hardcode them into this component

### 4. Layout
- The tabs will appear just below the hero section
- Selecting "Temp Class Schedule" hides the filters/week navigation and shows the static schedule instead
- Selecting "Class Schedule" shows everything as it works today

## What I Need From You
Once this plan is approved, please share the Reformer Pilates schedule for Duha (days and times) and I'll build it right away.

## Technical Details

**Files to create:**
- `src/components/booking/TempClassSchedule.tsx` -- static schedule display component

**Files to modify:**
- `src/pages/Schedule.tsx` -- wrap content in Tabs, add the temp schedule tab

**Database changes:**
- Insert instructor record for "Duha" into `instructors` table

