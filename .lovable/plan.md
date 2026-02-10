

## Multi-Feature Plan: Guest Pass Tracking, Credit Notifications, Admin Credit Booking, Time Format Fix, and Guest Pass Day-Of Purchase

This plan covers 5 distinct items you've requested. Here's a summary of findings and what needs to change:

---

### 1. Guest Pass Tracking and Notifications

**Current state:** Guest passes are listed in `/admin/guest-passes` with date filters and search, but there are no proactive notifications (e.g., for today's expected guests or expiring passes).

**What we'll add:**
- A "Today's Guests" summary card at the top of the admin Guest Passes page showing how many guests are expected today (based on `valid_date`)
- A notification badge in the admin sidebar for today's expected guests
- Status tracking improvements: show "Checked In" vs "Not Yet Arrived" for today's passes

---

### 2. Member Credit Tracking and Notifications

**Current state:** Credits are visible in the member portal (`/member/credits` and `/member/wellness`) but there are no expiration warnings or low-balance notifications.

**What we'll add:**
- A notification banner on the Member Dashboard when credits are expiring within 7 days or running low (1-2 remaining)
- An admin-side credit health indicator on the Member Detail page showing members with expiring or depleted credits
- Toast notification when a credit is successfully used for a booking

---

### 3. Admin Ability to Book Members for Credit Sessions

**Current state:** Only members can book wellness sessions for themselves via the `SpaBookingModal`. Admins cannot book on behalf of a member using their credits.

**What we'll add:**
- An "Admin Book Session" button in the Credits tab of the Member Detail page (`/admin/members/:id`)
- This will open a booking dialog where admin selects:
  - Service type (Red Light Therapy or Dry Cryo)
  - Date and time
  - Payment method (use member's credit, or charge card)
- The booking will deduct from the member's credits and create a `spa_appointments` record

---

### 4. Booking Times: Regular Hours Instead of Military Time

**Current state:** Mixed. The `ClassCard` component already formats times as `h:mm a` (e.g., "9:00 AM"). However:
- The **Bookings page** (`Bookings.tsx`) shows times as `start_time.slice(0, 5)` which gives military format like "13:00"
- The **Member Dashboard** also uses `.slice(0, 5)` for upcoming booking times
- The **SpaBookingModal** time slot buttons display raw "09:00", "13:00", etc.

**What we'll fix:**
- `src/pages/member/Bookings.tsx`: Convert `start_time` and `end_time` to 12-hour format (e.g., "1:00 PM")
- `src/pages/member/Dashboard.tsx`: Same conversion for the upcoming class display
- `src/components/booking/SpaBookingModal.tsx`: Display time slots as "9:00 AM", "1:30 PM", etc.
- `src/pages/member/Wellness.tsx`: Format appointment times in 12-hour format

---

### 5. Guest Pass: Same-Day Purchase and Male Gender Block

**Current state:**
- The date picker starts at `startOfDay(new Date())` -- which should allow today. This is already correct in the code (`minDate = startOfDay(new Date())`), so same-day purchase is already supported.
- The **male gender block IS implemented** server-side in `stripe-payment/index.ts` (line 567). When `guestGender === 'male'`, it throws the stealth error: *"We're sorry, guest passes are currently at capacity..."*

**Issue found:** The server-side block exists but the error message may not be surfacing properly to the user. The frontend catches errors and shows `error?.message`, but the edge function error format may not propagate cleanly.

**What we'll fix:**
- Verify the error propagation path from edge function to the toast message
- Add a client-side pre-check as well: when the user selects "Male", immediately show a gentle capacity message inline (before they fill out the rest of the form), so they don't waste time filling everything out only to get blocked at checkout
- Confirm same-day purchase works (the code already allows it)

---

### Technical Details

| File | Changes |
|------|---------|
| `src/pages/admin/GuestPasses.tsx` | Add "Today's Guests" summary card, check-in status tracking |
| `src/components/admin/AdminSidebar.tsx` | Add guest pass notification badge for today's expected guests |
| `src/pages/member/Bookings.tsx` | Convert time display from military to 12-hour format |
| `src/pages/member/Dashboard.tsx` | Convert upcoming booking time to 12-hour format |
| `src/components/booking/SpaBookingModal.tsx` | Format time slots as 12-hour, add admin booking support |
| `src/pages/member/Wellness.tsx` | Format appointment times to 12-hour |
| `src/pages/member/Dashboard.tsx` | Add credit expiration/low-balance notification banner |
| `src/pages/admin/MemberDetail.tsx` | Add "Book Wellness Session" button in Credits tab |
| `src/pages/GuestPass.tsx` | Add inline capacity message when male is selected |
| `src/components/admin/MemberDetailSheet.tsx` | Add credit health indicator |

### Helper utility (new file):
- `src/lib/timeFormat.ts` -- A shared utility to convert "HH:mm:ss" to "h:mm AM/PM" format, used across all time displays

