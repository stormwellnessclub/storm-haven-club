
## Problem

The Sound Bath event page exists at `/events/sound-bath-jul-25-2026` but there is no link to it anywhere in the public marketing site. `Navigation.tsx` and `Footer.tsx` link to Classes, Spa, Cafe, etc., but not Events, so visitors can't discover it.

## Plan

1. **Add "Events" link to main site navigation** — `src/components/Navigation.tsx`
   - Insert `{ href: "/events", label: "Events" }` in the `navLinks` array (after "Classes").
   - Same link appears automatically in the mobile menu since both use `navLinks`.

2. **Add "Events" to footer** — `src/components/Footer.tsx`
   - Add `{ label: "Events", href: "/events" }` under the "Experience" column alongside Classes/Spa/Cafe.

3. **Create a public `/events` index page** — `src/pages/EventsIndex.tsx` + route in `src/App.tsx`
   - Lists all rows from `events` where `status = 'published'` and `starts_at >= now()`, ordered by date.
   - Each card shows the event hero image, title, date/time (America/Detroit), price tiers (member/non-member), seats remaining (using the existing capacity RPC), and a "Reserve" button that links to `/events/:slug`.
   - Empty state: "No upcoming events right now — check back soon."
   - Styled to match the marketing site (gold accent, serif headline) consistent with the existing `EventAnnouncementBanner`.

4. **Route wiring** — add `<Route path="/events" element={<EventsIndex />} />` in `App.tsx` above the existing `/events/:slug` route.

Scope stays purely presentational/discovery — no changes to booking, Stripe, or admin.
