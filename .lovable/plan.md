The existing `send-sound-bath-vote-blast` function is for the vote (now closed). The event is confirmed for **Saturday, July 25 at 7:00 PM**, so we need a new announcement blast that drives ticket sales.

## What I'll build

### 1. New edge function: `send-sound-bath-event-blast`
- Admin-only (via `requireStaff`).
- Three modes controlled by request body:
  - `{ preview: true }` → returns rendered HTML for the in-app preview dialog (no send, no log).
  - `{ testEmail: "stormfitnessllc@gmail.com" }` → sends one real email to that address, logs it under a distinct `email_type` (`sound_bath_event_test`) so it doesn't affect dedupe.
  - `{}` → full blast to all `status = active` members with an email, idempotent via `email_audit_log` on `email_type = sound_bath_event_jul_25_2026`.
- Uses Resend, `from: Storm Wellness Club <admin@stormwellnessclub.com>`.

### 2. Email content
Same brand styling as the vote email (cream/gold/dark, serif). Content:
- Header: "You're Invited" / "Sound Bath, Nervous System Reset & Guided Meditation"
- Date: **Saturday, July 25, 2026 · 7:00 PM** (90 minutes)
- Led by Crystal Bell — full experience description (breathwork → guided meditation → extended sound bath)
- Tickets: Members $30 · Non-Members $40
- What to bring: mat, pillow, blanket, eye mask
- Primary CTA button → `https://stormwellnessclub.com/events/sound-bath-jul-25-2026`
- Secondary link → `/events`
- Footer with contact

### 3. Admin UI (in `/admin/events` → Sound Bath event detail, next to existing Preview/Send buttons)
- **Preview email** button — opens dialog with iframe (reuse `PreviewVoteEmailButton` pattern, new component `PreviewEventEmailButton`).
- **Send test to me** button — prompts/defaults to `stormfitnessllc@gmail.com`, sends single test.
- **Send blast** button — confirm dialog, then fires full send (reuse `SendVoteBlastButton` pattern).

## Flow for you
1. I ship the function + buttons.
2. You click **Preview email** to review in-app.
3. You click **Send test** → email lands at stormfitnessllc@gmail.com.
4. Once you approve, click **Send blast** to email all active members.

Confirm and I'll build it.
