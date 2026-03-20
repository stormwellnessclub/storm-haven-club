

## Fix: Make Public Schedule Reflect Admin Changes + Add Class Images

### Problem 1: Old class times still showing
The public-facing class schedule (`/classes` page and `TempClassSchedule`) uses **hardcoded class data** — static arrays defined directly in code. When you edit schedules in the admin panel, those changes only affect the `class_schedules` and `class_sessions` database tables, which the public UI never reads. That's why paused/edited classes still appear with old times.

### Problem 2: Missing images on reformer cards
The booking cards (`TempClassCard`) don't render any image. The `class_types` table has an `image_url` field, but the card component ignores it.

### Solution

#### 1. Rewrite `/classes` page to pull from the database
- Replace the hardcoded `classes[]` array with a query to `class_types` (active only)
- Each card shows: name, category, duration, capacity, heated badge, description, and the `image_url` from the database
- If `image_url` is null, fall back to a category-based default image (the existing imported assets)
- Inactive/paused class types won't appear since we filter by `is_active = true`

#### 2. Update `TempClassSchedule` to read from `class_sessions` instead of hardcoded schedule
- The soft launch period ended (March 19). Replace the hardcoded `getClassesForDate()` with a database query to `class_sessions` joined with `class_types` and `instructors`
- This means admin schedule changes (pausing, time edits, cancellations) immediately reflect in the public booking UI
- Keep the existing enrollment/booking/waitlist logic — just change the data source

#### 3. Add class type images to booking cards
- Update `TempClassCard` to accept and display `image_url` from `class_types`
- Show a small image thumbnail or header image on each booking card
- If no image is set, show a subtle category-based placeholder

### Files to modify
- `src/pages/Classes.tsx` — replace hardcoded array with database query
- `src/components/booking/TempClassSchedule.tsx` — switch from hardcoded schedule to `class_sessions` query
- `src/components/booking/ClassCard.tsx` — add image rendering support

### What this fixes
- Admin schedule edits (time changes, pausing, adding/removing classes) will immediately appear on the public website
- Paused/inactive schedules won't show
- Reformer classes with `image_url` set in the database will display their images

