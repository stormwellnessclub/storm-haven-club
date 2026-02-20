
## Fix: "Opens Soon" on Temp Schedule Tab

### Root Cause

The "Opens soon" message is NOT coming from `isSoftLaunch` (which is already `false`). It comes from the `ClassCard` component (`src/components/booking/ClassCard.tsx` lines 96-109), which shows "Opens soon" when `bookingDisabled={true}` is passed to it.

The `ClassCalendar` receives `bookingDisabled={isSoftLaunch}`, and since `isSoftLaunch = false`, the week grid is fine. **The issue is in the day view** (when a user clicks a day button to filter to one day) — in that inline card rendering (lines 297-312 of `Schedule.tsx`), the button is also wrapped in an `{isSoftLaunch ? ... "Booking opens soon" : <Button>}` block. Since `isSoftLaunch` is `false`, those inline day-view cards should be fine too.

**The real user-facing issue**: The Temp Schedule tab's "Book Class" button calls `onBookRequest`, which in `Schedule.tsx` is `() => setActiveTab("full")`. This just jumps to the Full Schedule tab. The Full Schedule tab opens on the **current week**, which is week 0. The real sessions exist in the database and the calendar renders them — but members are landing on the week view and may not realize they need to click a class card to actually book.

However, since the database **does have real sessions** for the soft launch period (Feb 20 – Mar 18), the simpler and cleaner fix is to **retire the Temp Schedule tab entirely** and make the Full Schedule the default tab. This eliminates confusion and lets members book directly from the live database sessions.

Additionally, the Temp Schedule's "Book Class" button text is misleading — it doesn't actually book, it just tab-switches.

### The Fix

**Two changes, one file: `src/pages/Schedule.tsx`**

1. Change the default active tab from `"temp"` to `"full"`:
   ```tsx
   // Line 21 - change:
   const [activeTab, setActiveTab] = useState("temp");
   // to:
   const [activeTab, setActiveTab] = useState("full");
   ```

2. Update the Temp Schedule tab trigger to act as a reference-only view, and update the `onBookRequest` prop to switch to the full tab — this already works correctly, so no change needed there.

That's it. The "Full Schedule" tab is already fully working with live database sessions, `isSoftLaunch = false`, and the `BookingModal` no longer has redundant agreement checks. Members will land directly on the bookable schedule.

### Why the Temp Tab Existed

The Temp Schedule was a static fallback used before real database sessions were generated. Now that real sessions exist in the DB for the full soft launch window (Feb 20 – Mar 18), the static display is redundant and confusing.

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/pages/Schedule.tsx` | 21 | `useState("temp")` → `useState("full")` |

No other changes needed. The database has sessions, `isSoftLaunch` is `false`, and the booking modal is already unblocked.
