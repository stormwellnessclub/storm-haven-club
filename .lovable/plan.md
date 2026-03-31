

# Show Class Ratings on the Schedule

## Current State
The review system already works: members can leave 1-5 star reviews from their past bookings, and each booking allows one review. Since each class attendance creates a new booking, members can rate every time they take a class. The `get_all_class_type_ratings` RPC already aggregates average ratings per class type.

**The missing piece**: ratings are never displayed on the public/member-facing class schedule.

## Plan

### 1. Add ratings to ClassCard (src/components/booking/ClassCard.tsx)
- Accept an optional `rating` prop: `{ average: number; count: number } | null`
- Display a small `StarRating` component (with average + count) below the class name/category badge
- Example: ★★★★☆ 4.2 (17)

### 2. Fetch and pass ratings in ClassCalendar (src/components/booking/ClassCalendar.tsx)
- Call `useClassTypeRatings()` to get the ratings map
- Pass the matching rating data to each `ClassCard` via the new prop

### 3. No database changes needed
- The `class_reviews` table, unique constraint, and `get_all_class_type_ratings` RPC already exist and work correctly
- The per-booking uniqueness means users already can review each time they attend

### Files Changed
- `src/components/booking/ClassCard.tsx` — add rating display
- `src/components/booking/ClassCalendar.tsx` — fetch ratings and pass to cards

