## 1. Enrich event "More info" content

Add two new optional text fields to `events` so we can describe the experience without cramming everything into `description`:

- `details` — long-form "what the event entails" (agenda, vibe, who it's for).
- `what_to_bring` — bulletable list of recommended items.

Migration:
```sql
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS what_to_bring text;
```

Populate for the Sound Bath (Jul 25, 2026) with copy along these lines (final wording will be a single UPDATE, editable later in admin):

- **Details:** ~90 min immersive sound healing journey using crystal + Tibetan bowls, gongs, and chimes. Doors 6:30 PM, session 7:00 PM. Light refreshments after. All levels welcome — no experience needed.
- **What to bring:** yoga mat, blanket, pillow/bolster, water bottle, eye mask (optional), comfy layers. Arrive 15 min early to settle in.

Render on `src/pages/EventPage.tsx`:
- New "What to expect" section (from `details`) above the ticket form.
- New "What to bring" section rendered as a bulleted list (split `what_to_bring` on newlines).
- Both sections only show if the field is set, so other events aren't forced into the same shape.

Also surface `details` / `what_to_bring` in the admin event edit form (`src/pages/admin/EventDetail.tsx` or its editor) as two textareas so you can update copy without SQL.

## 2. Add "Events" to member + non-member portal navigation

The non-member portal reuses `PortalSidebar` + `PortalBottomNav` (there is no separate non-member sidebar), so a single change covers both audiences.

- `src/components/portal/PortalSidebar.tsx`: add `{ title: "Events", url: "/portal/events", icon: Ticket-ish }` in the main group (between "My Bookings" and "My Passes", or right after "Recovery Booking" — will pick whichever reads cleaner in the existing order).
- `src/components/portal/PortalBottomNav.tsx`: replace one of the less-used mobile slots with an Events entry, or add as a 4th item if space allows (mobile nav currently has 3).

Route target `/portal/events` will render a lightweight portal-flavored list (reusing the public `EventsIndex` query) so members stay inside the portal chrome instead of bouncing to the public marketing page. Clicking an event still routes to the existing `EventPage` for purchase.

## Technical notes

- No changes to Stripe, checkout, or `get_event_availability`.
- RLS on `events` already allows public read of `on_sale` events; new columns inherit that.
- Icon: use `Sparkles` or `Ticket` from lucide-react (already imported in sidebar).
