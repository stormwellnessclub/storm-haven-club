

## Plan: Class Review & Rating System

### Database Changes (1 migration)

Create a `class_reviews` table:
- `id` UUID PK
- `user_id` UUID references auth.users (reviewer)
- `booking_id` UUID references class_bookings (ensures they attended)
- `class_type_id` UUID references class_types (for aggregate ratings)
- `session_id` UUID references class_sessions (specific session reviewed)
- `rating` INTEGER 1-5 (validated via trigger)
- `review_text` TEXT (optional written review)
- `is_visible` BOOLEAN default true (for moderation)
- `created_at`, `updated_at` TIMESTAMPTZ

Unique constraint on `booking_id` so each booking gets one review.

Create a DB function `get_class_type_ratings(class_type_id)` that returns average rating and review count for display.

RLS policies:
- Anyone authenticated can read visible reviews
- Users can insert reviews only for their own completed/confirmed bookings (past date)
- Users can update their own reviews
- Staff can manage all reviews (moderation)

### Frontend Changes

**1. Review submission on Past Bookings page (`src/pages/portal/Bookings.tsx`)**
- Add a "Leave Review" button on each past booking card (only if no review exists yet)
- Opens a dialog with star rating (1-5) and optional text field
- Shows "Reviewed" badge if already reviewed, with option to edit

**2. Display ratings on class schedule (`src/components/booking/TempClassSchedule.tsx`)**
- Show average star rating and review count on each class card
- Query aggregated ratings by class_type_id

**3. Reviews display component**
- New `ClassReviews` component showing reviews for a class type
- Accessible from the class cards (expandable or linked)
- Shows reviewer first name, star rating, date, and review text

**4. Public Classes page (`src/pages/Classes.tsx`)**
- Show average rating on each class card

### Technical Details

- Reviews are tied to `class_type_id` for aggregation (so "Reformer Sculpt" shows all reviews across sessions)
- Only past, completed/confirmed bookings can be reviewed
- Star rating component built with lucide Star icons
- Aggregate query uses a Supabase RPC or direct query with `.avg()` pattern

