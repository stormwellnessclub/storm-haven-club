## Problem

Non-members buying a Sound Bath ticket end up "pushed out" of the app with no on-screen confirmation, no `/portal/my-tickets` view, and no confirmation email.

Root causes found in the code:

1. **`BuyTicketsDialog` embedded payment sets `return_url: "${origin}/portal/my-tickets"`.** For any card that requires 3-D Secure (or any redirect payment flow), Stripe navigates the non-member to `/portal/my-tickets`, which is an auth-protected route → they get bounced to login/home. Nothing ever calls `finalize-event-ticket-payment`, so the ticket stays `pending`, the success screen is never shown, and no confirmation email is queued.
2. **The public `EventSuccess` page (`/events/:slug/success`) only handles Checkout `session_id`.** It has no branch for `payment_intent_id`, so even if we redirect non-members there we get "Missing session id".
3. **After a successful non-redirect payment**, `MyEventTickets` (used inside the dialog's fallback success) is a portal page — non-members can't reach it from the ticket email either (email link points to `/portal/my-tickets` when `user_id` is null it falls back to `/events`, but that page has no receipt).
4. **Confirmation email**: only fires from `finalize-event-ticket-payment`. If step 1 breaks, the email never sends. Also need to confirm `send-event-ticket-confirmation` and `finalize-event-ticket-payment` allow unauthenticated invocation (verify_jwt=false) so the flow works for guests.

## Fix

### 1. Public return / success URL for non-members
In `src/components/events/BuyTicketsDialog.tsx`:
- Determine `isAuthed` at dialog open (already fetched via `supabase.auth.getUser`).
- Pass `eventSlug` + `isAuthed` into `EmbeddedTicketPayment`.
- Set `return_url` to:
  - `${origin}/portal/my-tickets?just_purchased=1` when authed.
  - `${origin}/events/${slug}/success?payment_intent_id=${paymentIntentId}` when guest.
- Success-step CTA: for guests show "Done" only (no "View my tickets" link into portal).

### 2. Make `EventSuccess` handle `payment_intent_id`
In `src/pages/EventSuccess.tsx`:
- Read `payment_intent_id` from query params in addition to `session_id`.
- If `payment_intent_id` present, call `finalize-event-ticket-payment` with it; otherwise keep current `verify-event-ticket` flow.
- Render the same "You're in!" confirmation using the returned tickets (buyer name, event, time, venue, order id, "confirmation sent to <email>").
- Add a friendly note for guests: "Save this page or your confirmation email — your QR code will be emailed to you."

### 3. Ensure email always fires for guests
- `finalize-event-ticket-payment` already invokes `send-event-ticket-confirmation` on transition to `paid`. Confirm both functions are configured for public invocation (verify_jwt = false in `supabase/config.toml`; add entries if missing).
- In `send-event-ticket-confirmation`, when `user_id` is null set `portalTicketsUrl` to `${SITE}/events/${event.slug}/success?payment_intent_id=<pi>` so the "View my tickets" button in the email lands on a page the guest can actually open.

### 4. Deploy
Deploy `finalize-event-ticket-payment` and `send-event-ticket-confirmation` after changes.

## Out of scope
- Building a full guest ticket portal (QR code viewer for non-members) — the email + success page will carry the confirmation details and QR token for now.
- Any change to member/portal purchase flow (that already works).

## Files touched
- `src/components/events/BuyTicketsDialog.tsx`
- `src/pages/EventSuccess.tsx`
- `supabase/functions/send-event-ticket-confirmation/index.ts`
- `supabase/config.toml` (only if verify_jwt entries are missing)
