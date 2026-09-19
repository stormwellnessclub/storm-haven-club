# Women's Healing Circle — Sunday, September 27 · 6:00 PM

A members-only evening facilitated by Savannah Rae Alawieh, closing with a fire cleansing ritual. Included with membership, 30 seats held internally, waitlist when full, guest seats by request.

## The full copy, exactly as it will appear

### Listing card (events page & member portal)

**Women's Healing Circle**
Sunday, September 27 · 6:00 PM
An intimate evening of energy work, intuitive guidance and fire ceremony — held for the women of Storm.
*Included with membership · By reservation*

### Event page

**Women's Healing Circle**
Sunday, September 27 · 6:00 PM · Storm Wellness Club
*Members only · Included with your membership · Seating is intentionally limited*

There is a particular kind of quiet that only happens when women gather with intention. This evening is that: a private circle, candlelight, and space to set down what you have been carrying.

The circle is facilitated by **Savannah Rae Alawieh** — shaman, Reiki Master, astrologer and psychic medium — who guides the room through grounding, energy work and intuitive insight at an unhurried pace. Nothing is required of you but your presence; participation is always yours to choose.

The evening closes with a **fire cleansing ritual**. You will write down what you are ready to release, and let the flame carry it — a simple, ancient practice for stepping into the next season lighter than you arrived.

**What to bring**
Comfortable clothing you can sit and move in, a water bottle, and an open mind. Everything else is provided.

**Good to know**
Doors open at 5:45 PM so the circle can begin on time. Seating is intentionally limited to keep the evening intimate — reservations are first come, and a waitlist opens once the circle is full. Members may request a seat for a guest, granted based on availability.

**About Savannah Rae Alawieh**
Savannah Rae Alawieh is a shaman, Reiki Master, astrologer and psychic medium. Her work centers on energy healing, intuitive readings and ceremony, guiding women through release, clarity and reconnection with themselves.

### Buttons and messages members will see

- Member, seats open: **Reserve my seat** → "Your seat is reserved. We'll see you Sunday, September 27 at 6:00 PM."
- Member, circle full: **Join the waitlist** → "You're on the waitlist. We'll reach out the moment a seat opens."
- Guest: **Request a seat for a guest** → "Request received. We'll confirm by email based on availability."
- Not a member: "This circle is held exclusively for Storm members." with a link to apply.

No numbers anywhere on the member-facing side — no "12 spots left", no capacity, no counts. Only you and staff see the numbers.

### Confirmation email (sent on reservation)

Subject: **Your seat is reserved — Women's Healing Circle**
Body: date, time, doors at 5:45 PM, what to bring, the facilitator line, and a note to let us know if plans change so the seat can go to someone on the waitlist. Signed *The Storm Wellness Club Team*.

### Announcement email to members

I'll draft it and show you in full. It will not send until the event is live and you approve the wording.

## How it works

- **Members** reserve with one tap — no card, no checkout, nothing to pay.
- **Non-members** cannot reserve; the page invites them to apply for membership.
- **Guests** are requested by a member through a short form; you approve or decline based on availability, and approval emails the guest their confirmation.
- **Waitlist** opens automatically once the circle fills, held in order; you release a seat and that member is emailed.
- **Admin page** (Events → Women's Healing Circle) is where all the numbers live: reserved, remaining, waitlist in order, pending guest requests, plus a check-in list for Sunday evening.

## Technical notes

- `events`: add `members_only` (boolean, default false), `allow_guest_requests` (boolean, default false), `hide_capacity` (boolean, default false). Existing events unaffected.
- Complimentary reservation path: new `reserve-event-ticket` edge function — verifies via JWT that the caller is an active/frozen member, checks `get_event_availability`, inserts a confirmed `event_tickets` row with `amount_cents = 0`, `ticket_type = 'member'`. Stripe is not involved. `create-event-ticket-checkout` gains a guard rejecting checkout on a `members_only` event.
- New `event_waitlist` (event_id, user_id, name/email/phone, position, status) and `event_guest_requests` (event_id, requesting member, guest name/email/phone, note, status, decided_by, decided_at). RLS: members read/insert only their own rows; staff (super_admin, admin, manager, front_desk) manage all. Explicit GRANTs on both.
- Admin RPCs `approve_event_guest_request` and `offer_event_waitlist_seat` so issuing the ticket, consuming availability and marking the row happen atomically.
- Frontend: `EventsIndex.tsx`, `EventPage.tsx`, `PortalUpcomingEvents.tsx`, `BuyTicketsDialog.tsx` branch on `members_only` / `hide_capacity` and suppress all remaining-count text; new `ReserveSeatDialog`, `GuestSeatRequestDialog`, `WaitlistJoinDialog`; admin `EventDetail.tsx` gains Guest requests and Waitlist tabs with the live counts.
- Emails (confirmation, guest approval, waitlist seat released) through the existing `send-email` function and Storm template.
- Times stored UTC, displayed `America/Detroit`.
- The event row is created as data after the structure lands: slug `womens-healing-circle`, capacity 30, status `on_sale`, member price 0.
