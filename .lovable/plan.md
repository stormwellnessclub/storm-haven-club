

# Class Schedule & Booking System — Re-Audit Results

## What Was Fixed (Confirmed Working)
- **Double enrollment increment** — RPC updated, trigger handles it alone
- **Admin cancel parameter** — now uses `_cancellation_reason` correctly
- **useClassSessions hook** — filters `is_hidden`, `is_cancelled`, uses DB categories
- **Admin Today's Classes** — filters `is_cancelled = false`
- **Member Dashboard "Book Class" button** — links to `/schedule` (line 267)
- **Booking type interface** — category is now `string` not union

## Still Broken — Must Fix

### 1. Build Error: Duplicate `</p>` Tag (CRITICAL)
`src/pages/Schedule.tsx` line 130 has an extra `</p>` closing tag causing the build to fail completely. The site cannot deploy.

**Fix**: Remove the duplicate `</p>` on line 130.

### 2. Two More Broken `/member/schedule` Links (HIGH)
- `src/pages/member/Dashboard.tsx` line 356: "Browse Schedule" → `/member/schedule` (404)
- `src/components/member/EngagementNudge.tsx` line 49: "Book Now" → `/member/schedule` (404)

**Fix**: Change both to `/schedule`.

### 3. Schedule Filter Still Has Non-Matching "Cycling" Category (MEDIUM)
The DB has `pilates_cycling`, `aerobics`, and `other`. But the schedule filter buttons include a separate "Cycling" filter (`value: "cycling"`) which matches zero sessions. There's no `other` filter either.

**Fix**: Replace the filter list with:
- All Classes → `all`
- Pilates & Cycling → `pilates_cycling`
- Aerobics → `aerobics`
- Other → `other`

### 4. Schedule Page Still Read-Only — No Booking Buttons (MEDIUM)
The `/schedule` page shows class cards but has no "Book" button or CTA. Members land here from Dashboard but can't actually book. The `BookingModal` component exists and works but isn't integrated.

**Fix**: Add a "Book" button to each session card on the schedule page. When clicked, if logged in → open `BookingModal`; if not → redirect to `/auth?redirect=/schedule`.

### 5. No Cron Jobs for Edge Functions (HIGH)
The previous migration may have set up cron jobs, but this needs verification. The functions `process-session-generation`, `send-class-reminders`, and `process-expired-waitlist` need automated scheduling.

**Fix**: Verify cron jobs exist; create if missing.

### 6. Waitlist Notification Still Client-Side Only (LOW)
`cancel_class_booking` relies on client-side `notify-waitlist` call (line 421-429 in useBooking.ts). If the edge function call fails, the spot goes unfilled. The `process-expired-waitlist` cron (if set up) partially mitigates this.

No code change needed if cron is running — it serves as the safety net.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Schedule.tsx` | Fix duplicate `</p>` (line 130); update category filters; add booking button + BookingModal integration |
| `src/pages/member/Dashboard.tsx` | Fix `/member/schedule` → `/schedule` (line 356) |
| `src/components/member/EngagementNudge.tsx` | Fix `/member/schedule` → `/schedule` (line 49) |

## Priority Order
1. Fix build error (duplicate `</p>`) — site is broken
2. Fix remaining broken links (2 files)
3. Fix category filters to match DB
4. Add booking capability to schedule page
5. Verify/create cron jobs

