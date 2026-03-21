

## Fix: Admin Kids Care Bookings Not Visible (Timezone Bug)

### Root Cause
The admin Childcare page has a **double date filter** that breaks due to timezone parsing:

1. The database query correctly fetches bookings for the selected date (e.g. `booking_date = '2026-03-21'`)
2. But then line 47–50 in `Childcare.tsx` re-filters in JavaScript:
   ```js
   const bookingDate = new Date(booking.booking_date); // "2026-03-21" → UTC midnight
   return bookingDate.toDateString() === selectedDate.toDateString(); // local time comparison
   ```
   `new Date("2026-03-21")` creates **midnight UTC**. In US timezones (behind UTC), this displays as **March 20** locally. So the comparison fails and ALL bookings are filtered out.

### Fix

**File: `src/pages/admin/Childcare.tsx` (lines 47–50)**

Remove the redundant JavaScript date filter. The database query already filters by date — the JS filter is unnecessary and introduces the timezone bug. Replace with:

```js
const todayBookings = bookings || [];
```

This is safe because `useAdminKidsCareBookings({ bookingDate: selectedDate })` already returns only bookings for the selected date.

### Also fix: Member-side "upcoming bookings" (same bug likely)

**File: Check member-side kids care booking display** for similar `new Date(booking.booking_date).toDateString()` comparisons and fix them to use string comparison (`booking.booking_date === format(date, 'yyyy-MM-dd')`) or remove redundant filters.

### Files to modify
- `src/pages/admin/Childcare.tsx` — remove redundant timezone-broken date filter (line 47–50)

