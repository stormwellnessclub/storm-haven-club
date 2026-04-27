# Hide cancellation reason from admin-cancellation emails

When an admin cancels a class (or removes a single attendee), the email to the member should no longer display a "Reason" line. The reason will continue to be stored internally on the booking record (`cancellation_reason`) for admin/audit purposes — only the member-facing email is affected.

## Changes

### 1. `supabase/functions/send-email/index.ts`
In the `class_cancelled_by_admin` template (around lines 469–520), remove the conditional `${data.reason ? ... : ''}` block that renders the "Reason:" info box. The template will simply show the class/date/time, the credit-refunded confirmation, and the "Book Another Class" CTA — no reason field, regardless of what callers pass.

### 2. `src/pages/admin/Classes.tsx` (whole-session cancel)
Stop forwarding the reason to the email payload. In the `send-email` invocation around line 195, drop `reason: cancellationReason || null`. The admin's typed reason still gets saved to `class_bookings.cancellation_reason` via the RPC — it just won't appear in the outgoing email.

### 3. `src/pages/admin/ClassRoster.tsx` (single attendee removal)
Already passes `reason: null`, but for consistency remove the field entirely from the email payload (line 275).

## Out of scope / unchanged
- Member self-cancellation emails (`booking_cancellation`) — unaffected.
- Internal storage of `cancellation_reason` on bookings — unchanged, still recorded for admin visibility.
- Refund/credit-restoration logic — unchanged.
