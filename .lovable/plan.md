## Sound Bath — Saturday, July 25, 2026 · 7:00 PM

Reusable event ticketing system, seeded with this event.

## Database (one migration)

**`events`** — reusable, seeded with `sound-bath-jul-25-2026`
- `slug` (unique), `title`, `description`, `starts_at timestamptz`, `venue`, `capacity int`, `status` ('draft'|'on_sale'|'sold_out'|'closed'|'cancelled')
- `member_price_cents`, `non_member_price_cents`, `member_stripe_price_id`, `non_member_stripe_price_id`
- `image_url`, `created_at/updated_at`
- Grants: `SELECT` to anon+authenticated; ALL to service_role. Public read policy `USING (status <> 'draft')`; admin write via `has_any_role`.

**`event_tickets`** — one row per paid ticket
- `event_id`, `user_id` (nullable for guest checkout), `buyer_email`, `buyer_first_name`, `buyer_last_name`, `buyer_phone`
- `ticket_type` ('member'|'non_member'), `amount_cents`, `stripe_session_id` (unique), `stripe_payment_intent_id`
- `status` ('pending'|'paid'|'refunded'|'cancelled'), `qr_token` (uuid), `checked_in_at`, timestamps
- Grants: `SELECT/UPDATE` authenticated, ALL service_role. Policies: user sees own tickets (`auth.uid() = user_id`); admins see all; inserts only via service_role edge functions.

**RPC `get_event_availability(slug)`** → `{capacity, sold, remaining}` (SECURITY DEFINER, counts paid+pending-within-15-min rows). Exposed to anon+authenticated.

## Stripe

Create products in Stripe via the Stripe MCP:
- Product: "Sound Bath — Sat Jul 25, 2026" with two one-time prices: $30 (member), $40 (non-member). Store both `price_...` ids on the event row.

## Edge functions

**`create-event-ticket-checkout`** (auth optional, follows `gut-reset-create-checkout` pattern)
- Body: `{ slug, quantity, ticketType?, buyer: { firstName, lastName, email, phone } }`
- Server-side gating: if user is logged in, look up `members` by email; if `subscription_status` in ('active','frozen') → force `member` price. Otherwise → `non_member`. Client-provided `ticketType` is ignored for signed-in users.
- Calls `get_event_availability`; rejects if `remaining < quantity`.
- Creates Stripe Checkout Session with the right `price_id`, `mode: 'payment'`, success URL `/events/sound-bath/success?session_id={CHECKOUT_SESSION_ID}`, cancel URL `/events/sound-bath`.
- Inserts a `pending` `event_tickets` row per seat with `stripe_session_id`.

**`event-ticket-webhook`** — Stripe webhook (existing `stripe-webhook` extended, or a dedicated function). On `checkout.session.completed` for `metadata.kind = 'event_ticket'`:
  1. Update matching pending rows to `paid`, store payment intent id, generate `qr_token`.
  2. Enqueue **`event-ticket-confirmation`** app email (React Email template) with event details, ticket QR link, and `.ics` calendar attachment link.
  3. If sold out, flip `events.status = 'sold_out'`.

**`send-event-announcement`** (admin-only, `assertStaff`)
- Query recipients: all `members` (active/frozen), plus all `event_votes.user_id` for `sound-bath-jul-2026` (dedupe by email against members).
- Enqueues **`event-announcement`** email with the event card + a "Preview only / Send now" flag. Idempotency key = `event-announcement-<event_id>-<recipient>`.

## Email templates (React Email)

- **`event-announcement.tsx`** — Sound Bath date/time, price by audience (both prices shown; page auto-selects), CTA "Reserve your spot".
- **`event-ticket-confirmation.tsx`** — attendee name, event details, order # / QR link, calendar link, refund/policy line.

## Frontend

**Public `/events/sound-bath`**
- Hero card (event, date, capacity remaining pill "X spots left"), price display (auto-detected member/non-member based on logged-in status), quantity selector (1–4), guest fields if not signed in, "Buy ticket" → invokes `create-event-ticket-checkout` → redirects to Stripe.
- Sold-out state hides CTA, offers waitlist form (uses existing `class_waitlist` pattern? — out of scope for v1; show "Sold out, email us").
- **`/events/sound-bath/success`** — shows confirmation, ticket QR, add-to-calendar.

**Admin `/admin/events/:slug`** (replaces the sparse tracking page for future events, keeps existing `/admin/event-votes` for the vote)
- Header: event details, on_sale toggle, edit price/capacity.
- Stat cards: Tickets sold / Remaining / Revenue / Members vs non-members.
- Tabs:
  - **Roster** — sortable table of paid attendees (name, email, phone, type, amount, checked-in status), CSV export.
  - **Vote history** — link to existing vote tracking.
  - **Announcement** — "Preview" opens a modal rendering the exact email HTML with sample recipient; "Send blast" (guarded confirm dialog) enqueues to full list, shows queued count + live status from `email_send_log`.
- Also update `/admin/events` hub card to link here and show live ticket count from `get_event_availability`.

## Announcement flow (matches user preference)

1. Admin opens `/admin/events/sound-bath-jul-25-2026` → Announcement tab → **Preview email** (renders the exact HTML in a modal, no send).
2. Verify content, then click **Send blast** → confirm dialog listing recipient count → enqueues sends.
3. Live progress card shows queued/sent/failed counts polled from `email_send_log` deduped by `message_id`.

## Verification

- Stripe test-mode checkout for a member email ($30) and a non-member email ($40).
- After webhook, ticket row flips to `paid`, capacity RPC decrements, confirmation email logged in `email_send_log`.
- Cap enforcement: attempt 33rd purchase → returns "Sold out"; `events.status` → `sold_out`.
- Admin preview renders template; blast send only fires on confirm; recipients = members ∪ voters, deduped.
- `/admin/events` hub tile shows live sold/remaining.

## Not in scope (call out to user)

- On-site check-in scanner UI for QR (can add after; kiosk pattern exists).
- Refunds UI (manual via Stripe dashboard v1; refund status still reflected in row when webhook `charge.refunded` fires — will wire that hook).
- Waitlist beyond a static "sold out" message.

Confirm and I'll build it end-to-end.
