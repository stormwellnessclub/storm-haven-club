

## Fix Kids Care Booking Visibility

### Problems Found

**1. Timezone bug hiding bookings on both member and admin views**
The member page uses `parseISO(booking.booking_date)` which interprets `"2026-03-19"` as UTC midnight. For users in US timezones (EDT/EST), `isToday()` and `isFuture()` comparisons fail in the evening because the local date is ahead of UTC. This causes today's bookings to vanish from the "Active & Upcoming" list.

The admin page has the same issue — `bookingDate.toISOString().split("T")[0]` converts the local date to UTC before extracting the date string, potentially querying the wrong day.

**2. Room assignment from age — already working**
The booking hook (`useKidsCareBooking.ts`) already calculates `age_group` from the child's age via `getAgeGroup()` and assigns `room` as "Little Stars" (Infants/Toddlers) or "Big Stars" (Preschool/School Age). This is correctly stored in the database at booking time. No change needed.

### Plan

#### File: `src/pages/member/KidsCareBookings.tsx`
- Replace `isToday(parseISO(b.booking_date))` and `isFuture(parseISO(b.booking_date))` with timezone-safe date comparisons
- Parse booking dates as local dates (not UTC) by using `new Date(b.booking_date + "T00:00:00")` or splitting the date string into year/month/day components
- Compare against `format(new Date(), "yyyy-MM-dd")` for "today" check and string comparison for "future" check

#### File: `src/hooks/useAdminKidsCareBookings.ts`
- Fix the `bookingDate` filter to use `format(date, "yyyy-MM-dd")` (from date-fns, which uses local time) instead of `date.toISOString().split("T")[0]` (which uses UTC)
- Same fix for `dateFrom` and `dateTo` filters

### Expected Result
- Member sees their confirmed bookings immediately after creation, regardless of timezone
- Admin sees bookings for the correct local date when navigating between days
- Room assignment continues to work based on child age (no changes needed)

