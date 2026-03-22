

## Kids Care Enhancements — Multi-Child Passes, Cancel Policy, Admin Booking Management, and Dashboard Flyer

### Current State
- Kids Care pass purchase (`create_kids_care_checkout`) creates a single subscription with `quantity: 1`
- Cancel button exists on the member bookings page (`KidsCareBookings.tsx` line 244-252) and the hook enforces a **2-hour cancellation window** — cancellations less than 2 hours before the start time are blocked, and the credit is NOT restored (they lose it)
- Admin Childcare page has check-in/check-out but **no cancel, reschedule, or book-on-behalf** capabilities
- No Kids Care promotional banner on the member dashboard

---

### 1. Multi-Child Pass Purchases

**Problem:** Parents with multiple children can only buy one $75/mo pass (16 sessions). They need the ability to purchase additional passes for additional children.

**Solution:** Allow purchasing multiple passes. On the KidsCare hub page, if a parent already has an active pass, show a "Buy Another Pass" button. Each purchase creates a separate Stripe subscription and a separate `class_passes` row, so each child effectively has their own session pool.

**Files:**
- `src/pages/member/KidsCare.tsx` — When `hasActivePass`, show all active passes (not just `availablePasses[0]`) with their remaining sessions. Add "Buy Additional Pass" button below existing pass info that triggers the same checkout flow.

### 2. Cancellation Policy Clarification

**Current policy (already coded):** The 2-hour window is in `useKidsCareBooking.ts` line 297 — if `hoursUntilBooking < 2`, the cancel is blocked entirely (throws error: "Cancellations must be made at least 2 hours before the booking start time"). The credit IS restored for cancellations made 2+ hours before.

**Answer to your question:** Right now, cancellations within 2 hours are **fully blocked** (not allowed at all). The credit is only lost if you change this to allow late cancellations without refund. The current policy is: cancel 2+ hours before = credit restored; cancel under 2 hours = cannot cancel.

**No code change needed** unless you want to adjust this window. The cancel button is already active on member bookings.

### 3. Admin Booking Management (Cancel, Reschedule, Book for Parent)

**Files:**
- `src/pages/admin/Childcare.tsx` — Add three capabilities to each booking card:
  - **Cancel Booking** button (with confirmation dialog) — admin can cancel any booking and restore the credit
  - **Change Time** — inline time picker to update `start_time`/`end_time`
- Add a **"Book for Parent"** button at the top of the bookings tab that opens a modal where admin can:
  - Search/select a member
  - Select a registered child from that member's `kids_care_children`
  - Pick date and time
  - The booking uses the parent's pass

- `src/hooks/useAdminKidsCareBookings.ts` — Add mutations:
  - `useAdminCancelKidsCareBooking` — updates status to cancelled + restores pass credit
  - `useAdminUpdateKidsCareBookingTime` — updates start_time/end_time
  - `useAdminCreateKidsCareBooking` — creates booking on behalf of parent

- New DB function `admin_cancel_kids_care_booking` (SECURITY DEFINER) — cancels booking and restores pass credit atomically, bypassing RLS. Staff role check inside.

- New DB function `admin_create_kids_care_booking` (SECURITY DEFINER) — creates booking on behalf of a parent, deducts pass credit. Staff role check inside.

### 4. Kids Care Flyer on Member Dashboard

**File:** `src/pages/member/Dashboard.tsx`

Add a promotional banner/card after the "Up Next" section:
- Eye-catching card with Baby icon and accent styling
- Title: "Kids Care is Now Open!"
- Subtitle: "Supervised childcare while you work out. Ages 3 months to 10 years."
- Two buttons: "Get a Pass" (→ `/member/kids-care`) and "View Schedule" (→ `/member/kids-care-bookings`)
- Dismissible (use localStorage to track if user closed it)

### Files to modify
- `src/pages/member/KidsCare.tsx` — multi-pass display + "Buy Another Pass"
- `src/pages/admin/Childcare.tsx` — cancel, reschedule, book-for-parent UI
- `src/hooks/useAdminKidsCareBookings.ts` — admin mutations for cancel/reschedule/create
- `src/pages/member/Dashboard.tsx` — Kids Care flyer banner
- 2 new DB migrations for `admin_cancel_kids_care_booking` and `admin_create_kids_care_booking` functions

