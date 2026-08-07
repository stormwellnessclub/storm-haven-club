# Support Bell: Recurring Reminder + "Received" Acknowledgement

Today the concierge bell chimes on new support activity and repeats every 5 minutes while anything is open or unread. There is no way to silence a specific request short of resolving it — the only controls are a global mute and "Resolve".

## What changes

1. **Persistent reminder loop** — while any support request is unacknowledged, the bell repeats on a shorter cycle (every 60 seconds instead of 5 minutes), so it can't be missed.
2. **"Mark received" action** — each request in the support panel gets a Received button. Marking it received stops the reminder ringing for that request immediately, for every staff device (it's stored on the request, not per-browser).
3. **Still open until resolved** — a received request stays visible in the list with a "Received" badge and the staff member's name/time, and keeps its Resolve button. Resolving remains the separate final step.
4. **Re-arms on new activity** — if the member sends another message on a received request, the acknowledgement clears and the bell starts reminding again.
5. **Bell only counts unacknowledged** — the recurring reminder ignores requests already marked received; the badge count keeps showing all active requests so nothing disappears from view.

## Technical notes

- Migration on `public.email_conversations`: add `acknowledged_at timestamptz`, `acknowledged_by uuid`, `acknowledged_by_name text`. Update RLS/grants so staff roles can update these columns; front desk (kiosk, no auth session) goes through a SECURITY DEFINER RPC `kiosk_acknowledge_conversation(conversation_id)` mirroring the existing kiosk support RPC pattern.
- Trigger (or the existing inbound-message write path) clears `acknowledged_at` when a new `email_messages` row with `sender_type = 'member'` lands on the conversation.
- `useAdminSupportNotifications` returns an extra `unacknowledgedCount` (open/in_progress conversations with `acknowledged_at is null`, plus unread member messages on those). The kiosk RPC `kiosk_support_notification_counts` returns the same new field.
- `AdminSupportChime`: reminder interval drops to 60s and fires only when `unacknowledgedCount > 0`; initial realtime chime logic unchanged. Global mute still wins.
- `CheckInSupportPanel` (and the front desk Messages view, which reads the same conversations): add the Received button/badge next to Resolve, with optimistic update and query invalidation.
