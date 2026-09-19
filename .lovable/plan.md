# Under the Harvest Moon — Sunday, September 27 · 6:00 PM

A Women's Release & Renewal Circle. Members-only, complimentary with membership, 30 seats (count kept internal), waitlist when full, guest seats by request.

## The copy, exactly as it will appear

**Under the Harvest Moon**
*A Women's Release & Renewal Circle*
Sunday, September 27 at 6:00 PM
**An exclusive members-only experience**

Step into an intimate, restorative space designed to help you slow down, turn inward, and reconnect with yourself.

Facilitated by Savannah Rae Alawieh, Shaman, Reiki Master, Astrologer, and Psychic Medium. This guided experience will introduce guests to energy healing: a gentle practice centered on restoring balance, releasing emotional heaviness, and bringing awareness to where stress or stagnant energy may be held within the body.

Envision a softly lit circle, grounding guidance, intentional stillness, and the shared energy of women gathering in a safe, supportive space. The evening will culminate in a symbolic fire-cleansing ritual, inviting each guest to identify what she is ready to release and offer it to the fire creating space for renewed clarity, intention, and personal transformation.

This is an invitation to pause, soften, and leave feeling lighter, more grounded, and deeply connected to yourself.

**What to bring:** comfortable clothing you can sit and move in, a water bottle, and an open mind. Everything else is provided.
**Included with your membership · By reservation · Seating intentionally limited**

## What members see (no numbers, ever)

- Member, seats open: **Reserve my seat** → "Your seat is reserved. We'll see you Sunday, September 27 at 6:00 PM."
- Member, circle full: **Join the waitlist** → "You're on the waitlist. We'll reach out the moment a seat opens."
- Bringing a guest: **Request a seat for a guest** → "Request received. We'll confirm by email based on availability."
- Non-member: "This circle is held exclusively for Storm members," with a link to apply.

No capacity, no "spots left", no counts anywhere member-facing. Reserved / remaining / waitlist / guest requests are visible only to you and staff in the admin event page, alongside a Sunday-evening check-in list.

## The events page & community calendar

```text
/events
┌──────────────────────────────────────────────┐
│  Events at Storm            [ Grid | Month ] │
│  Filters: All · Members only · Open to all   │
├──────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │  image   │ │  image   │ │  image   │       │
│ │ SEP 27   │ │ OCT 11   │ │ OCT 25   │       │
│ │ Under the│ │  ...     │ │  ...     │       │
│ │ Harvest  │ │          │ │          │       │
│ │ Moon     │ │          │ │          │       │
│ │ 6:00 PM  │ │          │ │          │       │
│ │ Members  │ │          │ │          │       │
│ └──────────┘ └──────────┘ └──────────┘       │
└──────────────────────────────────────────────┘
        │ click a card
        ▼
┌──────────────────────────────────────────────┐
│  [image banner]                         [X]  │
│  SUNDAY, SEPTEMBER 27 · 6:00 PM              │
│  Under the Harvest Moon                      │
│  A Women's Release & Renewal Circle          │
│  Members only · Included with membership     │
│                                              │
│  Full description, facilitator, ritual,      │
│  what to bring                               │
│                                              │
│  [ Reserve my seat ]  [ Request a guest seat]│
└──────────────────────────────────────────────┘
```

- **Grid view** — large image cards with a date chip, title, time and a "Members only" or "Open to all" tag. Nothing about availability.
- **Month view** — a proper community calendar: events sit on their day, click a day to see what's on. Same card click behavior.
- **Click a card** — it opens enlarged in place, as an overlay with the full write-up and the reserve buttons, without leaving the page. Closing returns you exactly where you were.
- **Shareable** — the overlay also has its own address (`/events/under-the-harvest-moon`), so a link from an email or text opens straight to the full event, and the same page renders for search engines and link previews.
- **Past events** roll into a "Recently at Storm" strip so the page never looks empty between events.

## Emails

- **Reservation confirmation** — sent instantly: date, time, doors at 5:45 PM, what to bring, and a note to tell us if plans change so the seat can pass to the waitlist.
- **Guest approved / waitlist seat released** — sent when you approve from admin.
- **Announcement to members** — I'll draft it in full and show you. It does not send until the event is live and you approve the wording.

## Technical notes

- `events`: add `members_only`, `allow_guest_requests`, `hide_capacity`, `subtitle` (all nullable / defaulted false). Existing events unaffected.
- Complimentary reservation: new `reserve-event-ticket` edge function verifying via JWT that the caller is an active/frozen member, checking `get_event_availability`, inserting a confirmed `event_tickets` row at `amount_cents = 0`, `ticket_type = 'member'`. Stripe not involved. `create-event-ticket-checkout` gains a guard rejecting checkout on a `members_only` event.
- New tables `event_waitlist` (event_id, user_id, contact, position, status) and `event_guest_requests` (event_id, requesting member, guest contact, note, status, decided_by/at), both with member-own-row RLS, staff-manage RLS (super_admin, admin, manager, front_desk) and explicit GRANTs.
- Admin RPCs `approve_event_guest_request` and `offer_event_waitlist_seat` so ticket issue + availability + row status change atomically.
- Frontend: rebuild `EventsIndex.tsx` with grid/month toggle and the expanding detail overlay (shared `EventDetailView` used by both the overlay and `/events/:slug`); `PortalUpcomingEvents.tsx`, `EventPage.tsx`, `BuyTicketsDialog.tsx` branch on `members_only` / `hide_capacity` and suppress remaining-count text; new `ReserveSeatDialog`, `GuestSeatRequestDialog`, `WaitlistJoinDialog`; admin `EventDetail.tsx` gains Guest requests and Waitlist tabs with the live numbers.
- Emails through the existing `send-email` function and Storm template. Times stored UTC, shown `America/Detroit`.
- Event row created as data after the structure lands: slug `under-the-harvest-moon`, capacity 30, status `on_sale`, member price 0, members_only true, guest requests on, capacity hidden.
