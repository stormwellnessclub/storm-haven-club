## Goal

Whenever a class booking is cancelled — by a member, by a non-member, or by us — the affected person gets a confirmation email. Credit refund happens automatically when **we** cancel; when **they** cancel, refund is conditional on the existing 24-hour rule (already enforced at the DB level — no change needed).

## Current state (verified in code)

| Cancel path | Refund? | Email sent? | Notes |
|---|---|---|---|
| Member/non-member self-cancel (`useBooking.ts` → `cancel_class_booking` RPC) | ✅ Yes if ≥24hr, forfeited if <24hr | ✅ Yes (`booking_cancellation` template, with `credit_refunded` flag) | Working correctly |
| Admin cancels entire class session (`Classes.tsx` → `admin_cancel_class_session` RPC) | ✅ Always | ⚠️ Yes, but to wrong people | **Filter bug** — also emails people who self-cancelled earlier |
| Admin removes a single attendee from roster (`ClassRoster.tsx` "Remove" button) | ✅ Yes | ❌ **No email at all** | Member shows up to a class they're no longer booked into |

## Plan

### 1. Fix admin "cancel entire class" email recipient filter — `src/pages/admin/Classes.tsx`

The current code fetches `status === 'cancelled'` bookings *after* the RPC runs, which sweeps in anyone who cancelled themselves earlier. Change the filter to only include bookings cancelled by this admin action:

```ts
.eq('session_id', selectedSession.id)
.eq('status', 'cancelled')
.eq('cancellation_reason', 'Class cancelled by admin')   // ← new
```

The `admin_cancel_class_session` RPC already stamps exactly this reason on every booking it cancels (verified in migration `20260226024407`), so this is a clean filter with no risk of a race.

### 2. Send a cancellation email when admin removes a single attendee — `src/pages/admin/ClassRoster.tsx`

In the `removeMutation` (lines 200–246), after the booking is updated to `cancelled`:
- Fetch the member's email + name (already partially loaded into the roster) and the class name/date/time/instructor (already loaded for the page header).
- Invoke `send-email` with `type: 'class_cancelled_by_admin'` and the same data shape used in `Classes.tsx`. The template already says credits were restored, which matches what this action does.
- Best-effort send: don't block the cancellation toast if email fails (same pattern as elsewhere).

Also stamp the cancellation reason as `'Removed by admin'` on the booking update so it's distinguishable in audit/reports from a full-class cancellation.

### 3. (Small polish) Walk-in attendee fallback for the email name

The current admin cancel code falls back to `walk_in_email` / `walk_in_name`, which is correct. Verify the same resolution exists in the new ClassRoster path so guests with no `member_id` still get notified.

### 4. No changes to:
- `cancel_class_booking` RPC — 24-hr forfeit policy works as designed.
- `admin_cancel_class_session` RPC — already restores credits/passes correctly.
- `useBooking.ts` self-cancel email send — already correct.
- The `class_cancelled_by_admin` and `booking_cancellation` email templates — already exist and already convey refund status.

## What this does NOT cover (call out for your decision)

- **Waitlisted users with prepaid holds** when an admin cancels a session: I didn't see logic in `admin_cancel_class_session` to release/refund those holds or notify the waitlist. Per project memory, waitlist payment is held immediately and refunded if not cleared. Want me to also (a) refund prepaid waitlist holds and (b) email waitlisted users when the whole class is cancelled? I'd recommend yes but it adds scope — confirm before I include it.

## Files I'll edit

- `src/pages/admin/Classes.tsx` — add `cancellation_reason` filter to the email recipient query.
- `src/pages/admin/ClassRoster.tsx` — send `class_cancelled_by_admin` email after admin removes an attendee; stamp `cancellation_reason = 'Removed by admin'`.

No DB migration, no new edge function, no template changes.