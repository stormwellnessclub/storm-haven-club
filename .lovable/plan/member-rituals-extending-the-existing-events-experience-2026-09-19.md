# Member Rituals — extending the existing Events experience

## Part 1 — What exists today (audit)

**Public events page (`/events`, `/events/:slug`)**
- One events list with a grid view and a month-calendar view, plus a filter for members-only / open-to-all.
- Clicking a card opens an enlarged overlay with the full write-up; each event also has its own shareable page.
- Events are stored in a single `events` table: title, subtitle, description, details, what to bring, date/time, venue, capacity, image, status, member price, non-member price, plus the flags added for the moon circle (`members_only`, `allow_guest_requests`, `hide_capacity`).
- There is no notion of a collection/series, no tier eligibility, no facilitator field, no visibility control beyond "members only yes/no".

**Booking today**
- Paid events: card checkout through the existing payment system, producing a ticket record.
- Members-only complimentary events: one-tap "Reserve my seat", a waitlist, and a "Release my place" action — all inside the member's own Storm account. Guest requests exist but are switched off for the circle.
- Reminders and confirmations go out through the club's existing email sender.

**Member portal**
- Sidebar has "Events" (pointing at the public page) and "My Tickets".
- The dashboard shows an upcoming-events strip and, for the moon circle, the reserved state with the release option.
- "My Tickets" only lists paid/checked-in tickets — released or waitlisted places do not appear.

**Admin**
- `/admin/events` is a light hub listing events with ticket counts and revenue; `/admin/events/:slug` shows reservations, guest requests and waitlist.
- There is **no create/edit event form** — events have been created directly in the database by me.

**Membership data**
- Member records already carry a tier (Silver, Gold, Diamond, Platinum) and a founding-member flag, so eligibility can be read from what we already have.

Nothing below creates a second app, second login, or second database. Every piece extends the tables, account system and booking flow described above.

## Part 2 — What will be added, extended or reused

### Added
- A **ritual collections** concept (admin-managed list, not hard-coded): The Storm Book Society, Cinema at Storm, The Women's Salon, The Women's Health Edit, The Art of Rest, The Storm Supper Club, Seasonal & Special Rituals. Renameable, reorderable, archivable later.
- **Member Rituals overview page** — editorial introduction, then each collection as a large editorial block: title, short premium description, imagery, what to expect, eligibility label, "View Upcoming Rituals".
- **Member Rituals calendar** — calendar and list views, filters by collection, month and eligibility, warm editorial styling in the club palette (dark brown, cream, beige, taupe, gold; serif headings).
- **Eligibility per event** — public, all members, Diamond & Founding only, Diamond only, Founding only, selected tiers, or invitation only. Members see a simple label such as "Diamond & Founding Members" — never the internal ranking.
- **Early-access windows** — an optional priority booking period for Diamond and Founding members before general member booking opens.
- **Visibility per event** — publicly promoted, visible after sign-in, visible only to eligible members, or invitation only.
- **Membership access message** for logged-out visitors and non-members: an elegant panel offering Explore membership, Apply, or Sign in. Never an error state.
- **Portal page "Your Rituals"** — upcoming, waitlisted, past attended and cancelled bookings, plus recommended rituals matching her tier.
- **"Your Upcoming Rituals"** section on the member dashboard: next booked ritual with image, date, location, status, add to calendar, view details, and cancel/manage where the policy allows.
- **Add to calendar** and share actions on ritual detail pages.

### Extended (not replaced)
- The `events` table gains: collection, facilitator, eligibility, visibility, early-access window, waitlist toggle, "Included" pricing flag, cancellation policy text and duration.
- The existing events page gains an All Events / Public Experiences / Member Rituals filter and keeps working exactly as it does for public events.
- The existing reserve / waitlist / release flow is reused for rituals, with a tier check added server-side before a place is confirmed.
- Confirmation, reminder and waitlist-release emails reuse the existing Storm email templates.
- Portal sidebar gains "Member Rituals"; "My Tickets" is folded into the new rituals page for ritual bookings while paid public tickets stay where they are.
- Under the Harvest Moon moves into Seasonal & Special Rituals, keeping its page, image and existing reservations.

### Reused unchanged
Accounts and sign-in, membership records and tiers, payment handling for paid events, email sending, the admin events hub and its reservation/waitlist panels.

## Part 3 — Order of work

**Stage 1 — member-facing (this build)**
1. Database extension: collections plus the new event fields, with access rules.
2. Member Rituals overview page and the seven collections with editorial copy and imagery.
3. Member Rituals calendar with both views and all filters.
4. Ritual detail page with full information, eligibility, availability states and the reserve / waitlist / manage actions.
5. Eligibility enforcement at reservation time, including the early-access window.
6. Non-member membership access panel.
7. Portal: "Your Upcoming Rituals" on the dashboard and the full Your Rituals page.
8. Move Under the Harvest Moon into Seasonal & Special Rituals.

**Stage 2 — admin tools (straight after)**
Create/edit a ritual, assign collection, upload imagery, facilitator, date/time/duration/location, capacity, waitlist, eligibility, visibility, pricing or "Included", early-access window, cancellation rules, reservations and waitlist management, check-in, reminders, duplicate a recurring ritual, attendance history, and collection management.

Until Stage 2 lands I will set up any ritual you want, including the first Storm Supper Club (Diamond & Founding only) once you give me a date, seat count and price.

## Technical notes
- New `ritual_collections` table and additive columns on `events`; no existing column is dropped or renamed, so nothing currently live breaks.
- Eligibility is enforced in the reservation database function against the member's live status and tier, not in the browser, so the labels cannot be bypassed.
- Access rules let anyone read publicly promoted rituals, while invitation-only and member-visible rituals are readable only by signed-in eligible members and staff.
- All times stored in UTC, displayed in America/Detroit.
- No seat counts are shown to members where you have asked them hidden; availability states ("Limited availability", "Waitlist") are used instead.
