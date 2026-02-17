

## Fix: Dashboard Check-Ins Timezone Mismatch

### Root Cause

The dashboard calculates "today" using UTC:
```typescript
const today = new Date().toISOString().split('T')[0]; // UTC date
```

Then filters check-ins with:
```typescript
.gte('checked_in_at', `${today}T00:00:00`)
.lt('checked_in_at', `${today}T23:59:59`)
```

Since the club is in a timezone ahead of UTC (likely Asia/Beirut, UTC+2/+3), evening check-ins (e.g., 6 PM local = 4 PM UTC, or 11 PM local = 9 PM UTC) get recorded under the correct UTC timestamp, but the dashboard's UTC-based date filter misses check-ins that fall on the "previous" UTC day.

### Fix

Update the date boundary calculation in `src/pages/admin/Dashboard.tsx` to use the local timezone instead of UTC.

**File: `src/pages/admin/Dashboard.tsx`**

Replace:
```typescript
const today = new Date().toISOString().split('T')[0];
```

With a helper that computes the start/end of "today" in the local timezone, then converts to ISO strings for the query:

```typescript
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const todayStartISO = todayStart.toISOString();
const todayEndISO = todayEnd.toISOString();
const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
```

Then update the check-ins count query from:
```typescript
.gte('checked_in_at', `${today}T00:00:00`)
.lt('checked_in_at', `${today}T23:59:59`)
```
To:
```typescript
.gte('checked_in_at', todayStartISO)
.lt('checked_in_at', todayEndISO)
```

This ensures the "Today's Check-Ins" stat and the "Recent Check-Ins" list reflect the local day, not the UTC day.

### Technical Details

The same `today` variable is also used for:
- `spa_appointments.appointment_date` (line 71) -- uses date-only column, keep using local `today` (YYYY-MM-DD)
- `class_sessions.session_date` (line 72) -- uses date-only column, keep using local `today`

These date-only columns are unaffected by timezone since they store just a date. Only the `checked_in_at` timestamp filter needs the timezone-aware boundaries.

### Files to modify
- `src/pages/admin/Dashboard.tsx` -- Fix the check-in count query to use local timezone boundaries
