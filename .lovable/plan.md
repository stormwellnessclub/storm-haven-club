# The Events Portal

A dedicated staff portal for everything Storm hosts — public experiences, Member Rituals and the community calendar — living on its own at `/events-portal`, not buried inside the administration tabs. Same Storm sign-in, same database, same bookings; just its own workspace, the way the Staff Schedule portal works.

## 1. Its own home

`/events-portal` opens on a warm, editorial dashboard rather than a table:

- **Tonight / this week** — every upcoming event with its date, image, collection, how many places are held and how many remain.
- **Needs you** — pending guest requests, waitlists with people waiting, drafts never published, events with no image or no facilitator.
- **Recently held** — attendance and revenue at a glance.
- A prominent **Create an event** action.

Its own left-hand navigation: Dashboard · Calendar · All Events · Member Rituals · Collections · Requests & Waitlists · Attendance.

Reachable from the admin sidebar as a single "Events Portal" link and from the front-desk menu, so nobody has to hunt for it.

## 2. Calendar

A month and list view of everything scheduled, colour-coded by collection, with drag-free simple editing: click any event to open it. Filter by collection, eligibility, or public vs members-only.

## 3. The event editor

One clean form used for both public experiences and rituals:

- **The event** — title, subtitle, full write-up, what to expect, what to bring, image, venue.
- **When** — date, start time (Detroit time), duration.
- **Kind** — public experience or Member Ritual, and which collection.
- **Who it's for** — open to the public, all members, Founding only, Diamond only, Diamond & Founding, selected tiers, or invitation only.
- **Who can see it** — publicly promoted, visible after sign-in, visible only to eligible members, or invitation only.
- **Reservations** — capacity, waitlist on/off, early-access and general-access opening times, hide availability from members.
- **Cost** — "Included with membership", or member and non-member pricing.
- **Cancellation policy.**
- **Status** — draft, on sale, sold out.

**Duplicate** copies every setting into a fresh draft with the date cleared, for recurring rituals.

## 4. Images

Upload a photo right in the editor with a live preview of how the card will crop, or paste a link. The same uploader handles collection imagery, so you can replace the seven collection pictures I generated with your own photos whenever you like.

## 5. Collections

A Collections screen to add, rename, reorder, archive and re-photograph ritual collections, and edit each one's tagline, description, what-to-expect and eligibility note. Nothing is hard-coded.

## 6. Reservations, waitlist, check-in

Open any event to find:

- **Reservations** — everyone holding a place, searchable, with release-a-place and one-tap **Check in** for the night.
- **Waitlist** — in order, with "Release a place to her", which issues the place and emails her automatically.
- **Guest requests** — approve or decline.
- **Send an update** — a message to everyone holding a place, plus reminders, through the club's existing email sender.
- **Attendance** — who came, with a download.

## 7. Technical notes

- New route group `/events-portal/*` with its own layout and sidebar, gated to super_admin, admin, manager and front desk (front desk sees check-in and requests, not revenue). The existing `/admin/events` and `/admin/events/:slug` routes redirect into the portal so no link breaks.
- Reuses the existing `events`, `event_tickets`, `event_waitlist`, `event_guest_requests` and `ritual_collections` tables and the panels already built — no duplicate system.
- Image upload uses a public `event-images` storage bucket with staff-only write access.
- Eligibility and visibility remain enforced server-side in the reservation function; the editor only sets values.
- Times entered in Detroit time, stored in UTC. Member-facing screens still never show seat counts.

## After this

Tell me which collection pictures to swap and send the photos — I'll replace them straight away.
