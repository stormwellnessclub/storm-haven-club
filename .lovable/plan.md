## Goal

Add a **No Show** action on the class roster so admins can mark attendees who booked but didn't show up. Their credit/pass stays consumed (no refund), the booking flips to `no_show`, and they're never emailed.

## Changes

### 1. Booking status — `no_show`
`class_bookings.status` already accepts text values (`confirmed`, `completed`, `cancelled`, `waitlist`). Add `no_show` to the allowed set if there's a check constraint; otherwise no schema change is needed. (Will verify in build mode and only run a migration if a constraint blocks it.)

### 2. Per-row "No Show" button — `src/pages/admin/ClassRoster.tsx`
- Show on every row where `status === 'confirmed'` AND `!isCheckedIn` (i.e. they booked but never checked in).
- Sits next to the existing Check In / Remove actions, styled as a muted/secondary destructive variant with a `UserX` icon and tooltip "Mark as no-show (credit/pass not refunded)".
- On click → confirm dialog: "Mark {name} as no-show? Their class credit/pass will NOT be refunded."
- Mutation: `UPDATE class_bookings SET status = 'no_show', updated_at = now() WHERE id = ?`. No credit/pass restoration. No email.
- Toast: "Marked as no-show — credit/pass kept."
- Invalidates roster query so the row re-renders with a grey "No Show" badge (new badge variant added alongside the existing Confirmed / Checked In / Cancelled badges).

### 3. Bulk "Mark remaining as No Show" — roster header
- Button appears in the roster header next to existing actions, only when the class is `in-progress` or `completed` AND at least one `confirmed` non-checked-in attendee remains.
- Confirm dialog: "Mark all {N} remaining attendees as no-show? Their credits/passes will NOT be refunded."
- Single bulk update: `UPDATE class_bookings SET status = 'no_show' WHERE class_session_id = ? AND status = 'confirmed'`.
- Toast: "{N} attendees marked as no-show."

### 4. UI badges & filtering
- Add a `no_show` badge (grey/outline, "No Show") in the roster row renderer alongside the existing Confirmed / Checked In / Cancelled badges.
- No-show rows still appear in the roster (not hidden) so admins can see who missed.
- `current_enrollment` counts: confirmed bookings only — no-show rows are no longer `confirmed`, so the seat naturally frees from the count. This matches expected behavior (the spot was used by them not showing).

### 5. Out of scope
- No email to the no-show member.
- No "no-show fee" beyond the already-consumed credit (no extra Stripe charge).
- No automatic tagging / 3-strikes policy — can add later if you want.
- Reports/analytics changes — separate request.

## Technical notes

- Pure presentation + a thin mutation; no RPC needed.
- Single migration only if a check constraint on `class_bookings.status` rejects `no_show` — will verify first in build mode and skip the migration otherwise.
- Reuses existing toast, confirm dialog, and query-invalidation patterns already in `ClassRoster.tsx`.
