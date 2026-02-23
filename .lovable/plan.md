

## Align Both Portals: Class Passes, Bookings, and Cancellation Policy

### Summary

After reviewing both portals side by side, here is what each one currently has and what needs to be fixed to bring them both to the same standard.

### Current State

| Feature | Member Portal | Non-Member Portal |
|---------|--------------|-------------------|
| Pass count (X of Y remaining) | Yes (Credits page) | Yes (Dashboard + Passes page) |
| Progress bars on passes | Yes (Credits page) | Yes (Dashboard only) |
| Expiration color warnings | Yes (Credits page) | Yes (Dashboard only) |
| Upcoming/Past booking tabs | Yes | Yes |
| Class name, date, time | Yes | Yes |
| Instructor name | Yes | No |
| Time range (start - end) | Yes | Start only |
| Room | Yes | Yes |
| Cancel button on upcoming | Yes | Yes |
| Dynamic 24-hour cancel warning | **No** (generic static text) | **Yes** (AlertTriangle + bold text) |
| Dynamic confirm button text | **No** (always "Cancel Booking") | **Yes** ("Cancel Anyway" / "Yes, Cancel") |
| "Book a Class" shortcut on passes | Yes (Credits page) | **No** (Passes page lacks it) |
| Category display names | Yes (uses getCategoryDisplayName) | **No** (raw category with replace("_", " ")) |

### Changes

#### 1. Member Bookings -- Add dynamic 24-hour cancel messaging
**File:** `src/pages/member/Bookings.tsx`

- Import `differenceInHours` from date-fns and `AlertTriangle` from lucide-react
- Add `isLateCancel` calculation in `BookingCard` (same logic as non-member portal)
- Replace the static dialog description with dynamic text:
  - Late cancel: Warning icon + "This class starts in less than 24 hours. Your credit or pass **will not be refunded**."
  - Early cancel: "Are you sure you want to cancel this booking? Your credit or pass will be refunded."
- Change confirm button: "Cancel Anyway" for late cancels, "Yes, Cancel" for early cancels

#### 2. Non-Member Passes page -- Add progress bars, color-coded expiration, category names, and booking shortcut
**File:** `src/pages/portal/Passes.tsx`

- Import `Progress` component, `differenceInDays`, `parseISO`, and `getCategoryDisplayName`
- Replace raw `pass.category.replace("_", " ")` with `getCategoryDisplayName(pass.category)`
- Add a `Progress` bar showing remaining/total percentage on each active pass
- Color-code the expiration text (red when 14 days or fewer remain)
- Add a "Book a Class" button link on each active pass card
- Add header action buttons: "Book a Class" and "Buy More Passes" links

#### 3. Non-Member Bookings -- Add instructor and end time
**File:** `src/pages/portal/Bookings.tsx`

- Update the Supabase query to also select instructor info: `class_sessions ( ..., instructors ( first_name, last_name ) )`
- Display instructor name on each booking card when available
- Show start-end time range instead of just start time

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/member/Bookings.tsx` | Dynamic 24-hour cancel warning and button text |
| `src/pages/portal/Passes.tsx` | Progress bars, color-coded expiry, category names, booking shortcuts |
| `src/pages/portal/Bookings.tsx` | Add instructor info and end time to booking cards |

### What Already Works (No Changes Needed)

- Backend cancellation logic (refund vs forfeit based on 24-hour window)
- Member Credits page (full pass tracking with progress bars, history, shortcuts)
- Non-member Dashboard (pass summary with progress bars and upcoming bookings)
- Cancellation email notifications with refund status
- Waitlist notification on cancel
- Toast messages showing forfeit vs refund outcome
