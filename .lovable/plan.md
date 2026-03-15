

## Fix Support Notification — Make It Global & Recurring

### Problem
The notification chime (`playNotificationChime`) only fires inside `CheckInSupportPanel.tsx`, which is only mounted when the admin is viewing the check-in/support page. If they're on any other admin page, they never hear the sound.

### Solution
Create a global `AdminSupportChime` component that mounts inside `AdminLayout` and:
1. Listens to realtime events for new support messages (instant alert)
2. Polls every 5 minutes — if there are open tickets with unread messages, plays the chime again as a reminder
3. Stops ringing once all tickets are resolved or messages are read

### Files to Change

**1. Create `src/components/admin/AdminSupportChime.tsx`**
- Extract the audio logic (AudioContext singleton, `warmUpAudio`, `playNotificationChime`) into a shared utility or keep it in this file
- Subscribe to realtime `postgres_changes` on `email_conversations` (INSERT) and `email_messages` (INSERT, sender_type=member) — play chime immediately
- Set up a 5-minute interval that checks `useAdminSupportNotifications` data — if `unreadCount > 0`, play the chime
- Include a mute toggle stored in `localStorage` so admins can silence it
- Warm up AudioContext on first user click (browser requirement)

**2. Update `src/components/admin/AdminLayout.tsx`**
- Mount `<AdminSupportChime />` so it's always active on every admin page

**3. Update `src/components/admin/CheckInSupportPanel.tsx`**
- Remove the duplicate realtime chime subscription and audio logic from this component (it's now handled globally)
- Keep the visual UI, reply, and mark-done functionality intact

### Behavior
- Admin loads any page → AudioContext warms up on first click
- New member support message arrives → instant chime via realtime
- Every 5 minutes → if unread member messages exist, chime repeats
- Admin reads/resolves all messages → chiming stops
- Mute button in the header (persisted in localStorage) silences everything

