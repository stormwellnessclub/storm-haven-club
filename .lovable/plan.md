# Event Confirmation Email + Upcoming Event Bookings

## 1. Confirmation email (preview approved above)

Prereq check: verify Lovable Emails infrastructure is set up (`email_domain--check_email_domain_status`). If app-email scaffold is missing, run `setup_email_infra` → `scaffold_transactional_email` first.

Then:
- Add a new React Email template at `supabase/functions/_shared/transactional-email-templates/event-ticket-confirmation.tsx` matching the preview above (Storm brand: cream bg, serif heading, gold accent, dark text). Props: `firstName`, `eventName`, `eventDate`, `eventTime`, `venue`, `quantity`, `tierLabel`, `total`, `orderId`, `whatToBring`, `details`, `portalTicketsUrl`.
- Register it in `_shared/transactional-email-templates/registry.ts` as `event-ticket-confirmation`.
- In `supabase/functions/verify-event-ticket/index.ts`, after a successful Stripe session verification and ticket row insert, call `send-transactional-email` once per checkout session (idempotency key: `event-ticket-confirm-<stripe_session_id>`) with the buyer's email and the pulled event fields. Skip if already sent (check `email_send_log` by idempotency key, or add a `confirmation_sent_at` column on the checkout row).
- Deploy `verify-event-ticket` and any auth-email hook untouched.

## 2. Member upcoming event bookings

Show purchased event tickets alongside class bookings in the member's upcoming list.

- In `src/pages/member/Bookings.tsx` and `src/pages/portal/Bookings.tsx` (whichever renders "Upcoming"), add a query for `event_tickets` where `user_id = auth.uid()` (or matching email) joined to `events`, filtered to events whose `starts_at >= now()` and ticket `status = 'valid'`.
- Render event rows in the same upcoming list with a distinct **Event** badge, event name, date/time, venue, and a "View ticket" link to `/portal/my-tickets`. Keep classes and events sorted together by start time.
- No new tables; just a read. Confirm `event_tickets` RLS already allows the owner to select their rows (it does per prior setup).

## Out of scope
- No changes to Stripe checkout, pricing, or the existing `/portal/my-tickets` page.
- No reminder emails (only the immediate purchase confirmation).
