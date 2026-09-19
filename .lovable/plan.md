# Member Rituals — Admin Tools (Stage 2)

Give staff full control of rituals and public events from the admin area, so no event ever has to be set up by hand again. Everything extends the existing Events area — no new system.

## 1. Events hub becomes the control centre

`/admin/events` gains:

- A **Create event** button opening the new event editor.
- Two tabs: **Public experiences** and **Member Rituals**, plus past events.
- Each row shows date, collection, eligibility, visibility, reserved count and revenue, with quick actions: Edit, Duplicate, View reservations, Open public page.

## 2. Event editor (create and edit)

One clean form, grouped into sections:

- **The event** — title, subtitle, the full write-up, what to expect, what to bring, image, venue.
- **When** — date, start time (Detroit time), duration.
- **Kind** — public experience or Member Ritual; if a ritual, which collection.
- **Who it's for** — open to the public, all members, Founding only, Diamond only, Diamond & Founding, selected tiers, or invitation only.
- **Who can see it** — publicly promoted, visible after sign-in, visible only to eligible members, or invitation only.
- **Reservations** — capacity, waitlist on/off, priority booking window (early access opens / general access opens), hide availability from members.
- **Cost** — "Included with membership" or member / non-member pricing.
- **Cancellation policy** — free text shown on the event page.
- **Status** — draft, on sale, sold out.

Saving writes straight to the existing events table; slug is generated from the title and stays editable before publishing.

**Duplicate** copies every setting into a new draft with the date cleared — for recurring rituals.

## 3. Image handling

Upload an image directly in the editor (stored in the club's file storage, served over the CDN), or paste a link. The same uploader is used for collection imagery, so you can replace the seven collection pictures I generated with your own photos. A preview shows exactly how the card will crop.

## 4. Collection manager

New **Ritual collections** tab under the events hub: add, rename, reorder (drag), archive, edit the tagline / description / what-to-expect / eligibility note, and change the collection image. Nothing about the seven collections is hard-coded.

## 5. Reservations, waitlist and check-in

The event page at `/admin/events/:slug` gains:

- **Reservations** — every member who has a place, with search, release-a-place, and a one-tap **Check in** for the night of the event.
- **Waitlist** — in order, with "Release a place to her", which issues the place and emails her automatically (already built).
- **Guest requests** — approve or decline (already built).
- **Attendance history** — who attended past rituals, with a download.
- **Send an update** — a message to everyone holding a place, and a reminder send, both through the club's existing email sender.

## 6. Technical notes

- No schema changes needed beyond one additive column set already applied in `0031_member_rituals`; the editor writes existing columns. If image upload needs a storage bucket, a public `event-images` bucket is created with staff-only write access.
- Eligibility and visibility stay enforced server-side in the reservation function — the admin form only sets the values.
- Times are entered in Detroit time and stored in UTC.
- Check-in reuses the existing `event_tickets.checked_in_at` field and the front-desk check-in RPC.
- Member-facing screens still never show seat counts; counts appear in admin only.

## After this

Once the admin side is in, tell me which collection pictures to swap and send the photos — I'll replace them directly.
