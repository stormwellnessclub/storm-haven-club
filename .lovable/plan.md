Three changes: strip the vote + kids-care banners, drop a real event announcement banner in their place, and make sure event ticket sales are traceable as an "Events" category in both Stripe and our sales reports.

## 1. Remove existing banners

- `src/pages/portal/Dashboard.tsx` — delete the `<EventVoteCard voterType="non_member" />` block (line 151-152) and its import.
- `src/pages/member/Dashboard.tsx` — delete the `<EventVoteCard voterType="member" />` block (line 173-174) and its import.
- `src/pages/member/Dashboard.tsx` — delete the "Kids Care Flyer" block (lines ~222-250, the localStorage-dismissible "Kids Care is Now Open!" card).

(The user said "portal", but the kids-care flyer only lives on the member dashboard; portal has no kids-care banner. Removing it from the member dashboard so both surfaces stay clean.)

## 2. New: `EventAnnouncementBanner`

Create `src/components/events/EventAnnouncementBanner.tsx`:
- Query `events` where `status = 'on_sale'` and `starts_at > now()`, ordered by `starts_at`, limit 1.
- Also fetches `get_event_availability` for the live seat count.
- Renders nothing when there is no upcoming event.
- Visual: full-width banner card with a warm gold gradient, `Sparkles` icon, event title in `font-serif`, formatted date in `America/Detroit`, seats-left pill, and a prominent **"Reserve your seat"** button linking to `/events/{slug}`. Uses existing semantic tokens (`--gold`, `--primary`, etc.) — no hardcoded colors.
- Mobile-first: stacks vertically under `sm`, side-by-side above.

Mount it high on:
- `src/pages/member/Dashboard.tsx` (where the vote card was)
- `src/pages/portal/Dashboard.tsx` (where the vote card was)
- `src/pages/member/Book.tsx` (top of the Book screen so it's discoverable from the primary CTA path)

## 3. Stripe + reports categorization

**Stripe side (via `stripe_api_write`):**
- Patch product `prod_UuDcEEqBiDf9Vh` and both prices (`price_1TuPC1LyZrsSqLhs660RypmE`, `price_1TuPEYLyZrsSqLhs1Gwz31Ge`) to add metadata:
  - `category: "events"`
  - `event_slug: "sound-bath-jul-25-2026"`
  - `product_type: "event_ticket"`

**Edge function `create-event-ticket-checkout/index.ts`:**
- Add `category: "events"` to `session.metadata` and `payment_intent_data.metadata` alongside the existing `type: event_ticket`. This is what the sales-tax and payment reports read.
- Keep `payment_intent_data.description` as the human-readable event title (already present).

**Sales reports (`RevenueByCategoryReport.tsx`):**
- Add a 6th query to the `Promise.all`:
  ```ts
  supabase.from("event_tickets")
    .select("amount_cents, created_at")
    .gte("created_at", startDate).lte("created_at", endDate)
    .eq("status", "paid")
  ```
- Sum `amount_cents / 100` into a new `eventsRevenue` bucket.
- Add `{ name: "Events", value: eventsRevenue }` to the returned array (before `Other`), and add an Events color to the `COLORS` palette (8 colors → 9).

No schema changes needed — `event_tickets` already has `status`, `amount_cents`, and `created_at`, and reports pull from our DB rather than Stripe.

## Out of scope
- Announcement email/SMS blast to members + voters (ask separately when you want to launch).
- Backfilling past Stripe products with the new metadata (only the current event needs it).
