## Issues to fix

### 1. Confirmation email not delivered
Edge function logs show: `send-event-ticket-confirmation error: The notify.stormwellnessclub.com domain is not verified.` Resend rejected the send, so no email went out. The finalize function already invokes it correctly — the block is at the mail provider.

**Fix:** switch the sender to a verified sending identity we already use elsewhere in the project (same one auth/booking receipts use — e.g. `hello@stormwellnessclub.com` via the Lovable email infra). I'll confirm the currently verified sender by checking `email_domain--check_email_domain_status` and update `FROM` in `send-event-ticket-confirmation` to match. No template rewrite.

### 2. "View ticket" button unreachable on iPhone
On the member Bookings page the floating bottom nav (Book Activity / Support / Account) sits on top of the last event card, so the "View ticket" button can't be tapped.

**Fix:** in `src/components/bookings/UpcomingEventTickets.tsx` (and the surrounding sections in `member/Bookings.tsx` / `portal/Bookings.tsx`) add extra bottom padding on mobile so the last card clears the floating nav (increase container `pb-20` to `pb-32` on mobile only).

### 3. "View ticket" sends me to admin dashboard, not the ticket
`UpcomingEventTickets` is passed `myTicketsPath="/portal/my-tickets"` from BOTH the member and portal Bookings pages. For a member on `/member/*`, the app redirects `/portal/*` for non-portal users, landing you on admin.

**Fix:**
- Register a member-side route `/member/tickets` that renders the same `MyEventTickets` component inside `MemberLayout`.
- `src/pages/member/Bookings.tsx` passes `myTicketsPath="/member/tickets"`.
- Add "My Tickets" link to `MemberSidebar` pointing to `/member/tickets` (portal sidebar keeps `/portal/my-tickets`).
- Inside `MyEventTickets`, detect layout context so the "Back" and internal links stay within the current area.

### 4. Two pending tickets showing under my name
Each time the Buy dialog opens we insert `pending` rows plus a PaymentIntent, so abandoned attempts leave stale `pending` rows. Currently only "paid" rows should count against the roster, but they still clutter the admin pending KPI.

**Fix (two parts):**
- **Cleanup:** in `create-event-ticket-checkout`, before inserting new pending rows, cancel any existing `pending` rows for the same `buyer_email` + `event_id` older than 15 minutes (set `status = 'abandoned'`). Also add a lightweight scheduled job (extend the existing `process-abandoned-class-pass-checkouts` cron or add a sibling) that flips pending event tickets to `abandoned` after 30 min.
- **Admin visibility:** in `src/pages/admin/EventDetail.tsx`, split the "Pending" KPI into "Pending (active, <30m)" and "Abandoned", and add an "Abandoned" filter option in the roster table. This gives admin a clean list of people who started but never paid.

### 5. Track abandoned checkouts for follow-up emails
Same abandoned rows above become the follow-up list.

**Fix:**
- Add a small admin action on the EventDetail page: an "Email abandoned" button that opens a preview and sends a one-off reminder to abandoned buyers via the existing transactional email sender. No new cron/automation — manual send only for now.

### 6. Email logo/header misaligned on iPhone
The confirmation email uses a text header (no image logo) inside a `<div>` with `padding` but the outer wrapper doesn't set `width:100%` on the table for Gmail iOS/Apple Mail.

**Fix:** in `send-event-ticket-confirmation` `buildHtml`, wrap content in a proper `<table role="presentation" width="100%">` with a centered inner `<table width="600">`, and center the "STORM WELLNESS CLUB" eyebrow + title using `text-align:center` on the header cell. This is the standard email-client-safe pattern and renders identically on desktop and iPhone.

### 7. Admin ticket-sales tracking (clarification, no new code)
Admins already view sales at `/admin/events` → click the event → EventDetail page (paid / pending KPIs, roster with member vs guest, CSV export). I'll add a short note in the sidebar description and keep #4's abandoned split so admins see the full funnel: Paid, Pending (active), Abandoned.

## Files touched
- `supabase/functions/send-event-ticket-confirmation/index.ts` — sender + table-based HTML
- `supabase/functions/create-event-ticket-checkout/index.ts` — mark stale pending as abandoned before insert
- `supabase/functions/process-abandoned-class-pass-checkouts/index.ts` (or new sibling) — sweep pending event tickets
- `src/App.tsx` — add `/member/tickets` route
- `src/pages/member/Bookings.tsx` — path prop update, extra bottom padding
- `src/pages/portal/Bookings.tsx` — extra bottom padding
- `src/components/bookings/UpcomingEventTickets.tsx` — mobile padding, safer link behaviour
- `src/components/member/MemberSidebar.tsx` — "My Tickets" link
- `src/pages/portal/MyEventTickets.tsx` — layout-aware rendering
- `src/pages/admin/EventDetail.tsx` — abandoned split + "Email abandoned" action

## Out of scope
- Rebuilding the ticket detail page visuals
- Automated dunning sequence for abandoned buyers (only a manual one-off send)
- Changing pricing or purchase flow logic
