## Goal
After a member buys Sound Bath tickets, land them on an in-portal confirmation with their ticket details (and keep them visible later in "My Tickets").

## Changes

### 1. New portal page: `src/pages/portal/MyEventTickets.tsx`
- Route: `/portal/my-tickets` (accessible to members and non-member portal users).
- Reads `event_tickets` for the current `auth.uid()` joined with `events` (title, starts_at, venue, slug, details, what_to_bring).
- Renders each paid ticket as a card: event title, ET-formatted date/time, venue, ticket type (Member/Non-Member/etc.), buyer name, and a QR block using `qr_token` (rendered via existing QR util if present, otherwise a simple monospace token + note).
- If URL contains `?session_id=…&just_purchased=1`, calls `verify-event-ticket` first (to force-finalize just-completed sessions), then shows a green "You're in!" confirmation banner at the top with a subtle confetti/checkmark and CTA "Back to Events".
- Empty state: "No tickets yet — browse events" linking to `/events`.

### 2. Route success back into the portal for logged-in buyers
- `supabase/functions/create-event-ticket-checkout/index.ts`: if the request is authenticated (Authorization header resolves to a user), set  
  `success_url = ${origin}/portal/my-tickets?session_id={CHECKOUT_SESSION_ID}&just_purchased=1`.  
  Otherwise keep the existing public `/events/:slug/success` URL (guests).
- `src/pages/EventPage.tsx`: no logic change needed — the edge function decides the redirect based on auth.

### 3. Reuse verify function
- `verify-event-ticket` already returns `paid` + `tickets[]`. No change needed; the new portal page calls it exactly once when `session_id` is present, then also fetches all tickets for the user for the full list.

### 4. Sidebar entries
- `src/components/portal/PortalSidebar.tsx` and `src/components/member/MemberSidebar.tsx`: add a "My Tickets" link (icon: `Ticket`) pointing to `/portal/my-tickets`, placed just below the existing "Events" entry.

### 5. Router wiring
- `src/App.tsx`: register `/portal/my-tickets` inside the authenticated portal route group so it inherits the portal layout/guard.

### 6. Public `EventSuccess.tsx`
- Leave the existing public success page untouched for guest buyers (they aren't logged in).
- Add a small "View in your portal" button on it that only shows when a session is detected in `localStorage`/auth — optional, low priority.

## Technical notes
- RLS on `event_tickets` already restricts SELECT to `user_id = auth.uid()` (verified previously when we built the roster). No policy changes needed.
- QR rendering: use `qrcode.react` if it's already in the dependency tree; otherwise render `qr_token` as a styled code block — the front desk scanner can still key it in. (We'll check on implementation; no new dep unless needed.)
- Timezone: format all times with `formatInTimeZone(..., "America/Detroit", ...)` per project standard.
- No schema changes.

## Out of scope
- Emailing tickets (already handled).
- Admin-side changes.
- Transferring/refunding tickets from the portal.