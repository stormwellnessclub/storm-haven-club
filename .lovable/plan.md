

# Class Cancellation: Visibility Toggle, Admin Roster Access & Email Notifications

## What changes

### 1. Cancel dialog — add visibility toggle
In `src/pages/admin/Classes.tsx`, update the cancel dialog to include a checkbox/switch:
- **"Hide from members & website"** (default: checked) — sets `is_hidden = true`
- **"Keep visible as cancelled"** (unchecked) — sets `is_hidden = false`, so members see a "Cancelled" badge on the schedule

Pass the `_is_hidden` parameter to the existing `admin_cancel_class_session` RPC (it already accepts this param but the UI never sends it — currently defaults to `false`).

### 2. Admin view — always show cancelled sessions
Currently the admin Classes page filters with `.eq('is_hidden', false)`, which hides cancelled+hidden sessions even from admins. Remove this filter so admins always see all sessions (cancelled ones still show with the "Cancelled" badge and remain clickable to open the roster).

### 3. Send cancellation emails to all booked members
After the `admin_cancel_class_session` RPC succeeds, fetch all bookings that were just cancelled for that session, resolve each person's email, and invoke the existing `send-email` edge function with type `booking_cancellation` for each one. The existing template already shows class name, date, time, and credit refund info.

This will be done in the `onSuccess` callback of the cancel mutation — query `class_bookings` where `session_id` matches and `cancellation_reason = 'Class cancelled by admin'`, join to get email addresses, then fire off the emails.

### 4. Add a new email template for admin-initiated class cancellation
The existing `booking_cancellation` template says "Your booking has been cancelled" which is generic. Add a new `class_cancelled_by_admin` email type to `send-email` that specifically says the class was cancelled by the studio, includes the cancellation reason, and mentions credits were refunded. This gives better context than the generic booking cancellation.

### Files to change
- **Edit**: `src/pages/admin/Classes.tsx` — add visibility toggle to cancel dialog, remove `is_hidden` filter from admin query, send emails after cancellation
- **Edit**: `supabase/functions/send-email/index.ts` — add `class_cancelled_by_admin` email template

### Technical details
- The DB function `admin_cancel_class_session` already accepts `_is_hidden boolean DEFAULT false` — just need to pass it from the UI
- Email sending: after RPC success, query `class_bookings` joined with members/profiles to get emails, then call `send-email` for each
- The admin query removes `.eq('is_hidden', false)` so cancelled sessions always appear in admin view regardless of visibility setting

