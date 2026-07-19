## Goals
1. Fix the "Buy Tickets" button on the public `/events` and event detail pages so it actually completes a purchase.
2. Let members and non-members buy event tickets from inside the portal without ever leaving it.
3. Hide the remaining-seat count (e.g. "32 left") from any public/member-facing surface — only admins should see it.

## Current State (verified)
- `/events` (`EventsIndex.tsx`) "Buy Tickets" is `<Link to="/events/:slug#tickets">` → sends users to `EventPage.tsx`, where the form is at the bottom. Users perceive the top button as doing "nothing" because it only scrolls; the bottom checkout button calls the `create-event-ticket-checkout` edge function.
- `create-event-ticket-checkout` has no `verify_jwt` override in `supabase/config.toml`. On the current signing-keys defaults this can still 401 anonymous callers depending on client headers — anonymous purchase is a required path (non-members buying tickets).
- Portal shows the `EventAnnouncementBanner` (which already opens an inline dialog) only on the two Dashboards. The portal sidebar "Events" link and `MyEventTickets` page have no "Buy tickets" affordance, so users click through to the public event page and hit the same broken flow.
- `EventPage.tsx` renders `${remaining} left` badge and `EventAnnouncementBanner.tsx` renders `{remaining} seats left` — both are public.

## Changes

### 1. Reusable inline purchase dialog
- Extract the existing checkout dialog logic from `EventAnnouncementBanner.tsx` into a new shared component `src/components/events/BuyTicketsDialog.tsx` that takes an `event` prop plus `open/onOpenChange`, prefills from `auth.getUser()` + `profiles` (fixing the current `profiles.id` bug → use `user_id`), and calls `create-event-ticket-checkout`.
- Rewire `EventAnnouncementBanner.tsx` to use it.

### 2. Public pages — real Buy button, no seat count
- `EventsIndex.tsx`: replace the `<Link ...#tickets>` "Buy Tickets" button with an inline button that opens `BuyTicketsDialog` for that event. "More info" still links to `/events/:slug`.
- `EventPage.tsx`:
  - Remove the `${remaining} left` / capacity badge from the public header (keep "Sold Out" state only).
  - Replace the scroll-anchor "Buy Sound Bath Tickets" button with a button that opens `BuyTicketsDialog`. Remove the inline `#tickets` form section entirely (dialog is the single purchase surface).
  - Keep sold-out messaging based on `get_event_availability` but never render the raw number.

### 3. Portal — buy without leaving
- New component `src/components/events/PortalUpcomingEvents.tsx`: queries `events` where `status = 'on_sale'` and `starts_at > now`, renders each as a compact card with a "Buy Tickets" button that opens `BuyTicketsDialog`. The checkout `success_url` continues to route back to `/portal/my-tickets`.
- Inject `PortalUpcomingEvents` at the top of `src/pages/portal/MyEventTickets.tsx` and `src/pages/member/`… equivalent (the "My Tickets" surface) so the sidebar "Events" destination now shows upcoming + owned tickets on one page.
- The dialog itself performs Stripe redirect; on Stripe success the user is returned to `/portal/my-tickets` as today, so the perceived flow stays inside the portal outside of the unavoidable Stripe-hosted payment step.

### 4. Edge function anonymous access
- Add `[functions.create-event-ticket-checkout] verify_jwt = false` to `supabase/config.toml` so anonymous buyers on `/events` succeed. Server-side already validates all inputs, looks up the event, and computes price authoritatively — no auth needed.

### 5. Admin still sees remaining seats
- No changes to `/admin/events` or `EventDetail` — those already show capacity/remaining and stay untouched.

## Technical notes
- `BuyTicketsDialog` reads member/non-member price from the event prop passed in (already selected by callers), so no extra queries.
- Prefill order: dialog opens → `supabase.auth.getUser()`; if present, query `profiles` by `user_id` (not `id`) for `first_name/last_name/email/phone`.
- Availability is still checked server-side inside `create-event-ticket-checkout`; the client no longer needs `get_event_availability` on public pages, so remove those queries from `EventPage.tsx` and `EventAnnouncementBanner.tsx` (a boolean "sold out" comes from `events.status = 'sold_out'` which the server flips).
- No DB migrations required.

## Out of scope
- Redesign of `EventsIndex` layout.
- Changes to confirmation email or `verify-event-ticket`.
- Any admin UI changes.
