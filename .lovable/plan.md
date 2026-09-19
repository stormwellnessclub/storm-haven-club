# Women's Healing Circle — Sunday, Sept 27, 6:00 PM

A members-only evening facilitated by Savannah Rae Alawieh, closing with a fire cleansing ritual. Free for members, 30 spots, waitlist when full, guest spots by request.

## Event copy (as approved in chat)

Title: **Women's Healing Circle**
When: Sunday, September 27, 6:00 PM (Detroit time)
Capacity: 30 · Members only · Free

Description, what to bring, and the facilitator bio use the wording shown in chat. Nothing invented — if you want a photo of Savannah, an end time, or a room name, send them and I'll add them.

## How it will work

**On the public events page** the circle is listed like other events so people can see what Storm offers, but the ticket button behaves differently:

- **Signed-in member** — "Reserve my spot" claims a free ticket instantly. No card, no payment screen. Confirmation email sent with the date, time and what to bring.
- **Not a member / not signed in** — no checkout. They see "Members only" with a link to apply for membership.
- **Members bringing a guest** — a "Request a guest spot" form (guest name, phone, relationship, optional note). It does not reserve anything; it lands in the admin event page as a pending request you approve or decline based on availability. Approving issues the guest a ticket and emails them; declining sends nothing automatically.

**When the 30 spots are gone**, the button becomes "Join the waitlist". Waitlisted members are held in order. If a spot frees up (someone cancels, or you release one), you approve from the admin page and that person gets an email with their confirmed spot.

**In the admin area** (Events → Women's Healing Circle) you get, on one page:

- Live count: reserved / remaining / waitlisted / guest requests pending
- The attendee list with cancel and check-in
- Guest requests with Approve / Decline
- Waitlist in order with Offer spot
- A door check-in list for Sunday evening

## Email to members

I'll draft the announcement email and show it to you for approval. Nothing sends until you say go — and the event will already be live so the link in the email works.

## Technical notes

- `events`: add `members_only` (boolean, default false) and `allow_guest_requests` (boolean, default false). Existing events are unaffected.
- Free reservation path: new `reserve-event-ticket` edge function that server-side verifies the caller is an active/frozen member, checks `get_event_availability`, and inserts a confirmed `event_tickets` row with `amount_cents = 0`, `ticket_type = 'member'` — bypassing Stripe entirely. Existing `create-event-ticket-checkout` stays untouched for paid events, plus a guard that rejects checkout on a `members_only` event.
- New `event_waitlist` table (event_id, user_id, member name/email/phone, position, status, created_at) and `event_guest_requests` table (event_id, requesting member, guest name/email/phone, note, status, decided_by, decided_at). Both with RLS: members see/insert only their own rows; staff (super_admin, admin, manager, front_desk) manage all. Explicit GRANTs on both.
- Admin RPCs for approve-guest-request and offer-waitlist-spot so issuing a ticket, decrementing availability, and marking the request happen atomically.
- Frontend: `EventPage.tsx` / `EventsIndex.tsx` / `PortalUpcomingEvents.tsx` branch on `members_only`; new `ReserveSpotDialog`, `GuestRequestDialog`, `WaitlistDialog`; `EventDetail.tsx` (admin) gains Guest requests and Waitlist tabs.
- Confirmation, guest-approval and waitlist-cleared emails via the existing `send-email` function using the standard Storm template.
- All times stored UTC, displayed `America/Detroit`.
- The event row itself is created as data once the structure is in place (slug `womens-healing-circle`, status `on_sale`, capacity 30).
