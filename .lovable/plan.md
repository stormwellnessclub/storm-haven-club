## Problem

You're right — the Cafe page has visible, obviously-SEO copy at the top ("Café, Juice Bar & Smoothie Bar in Livonia, MI" + a paragraph listing surrounding cities like Farmington Hills, Plymouth, Northville, Novi, Redford, etc., plus a 6-tile grid of keyword-stuffed category descriptions). That reads like a chiropractor's landing page, not a premium club. None of it should be on screen.

The other pages (Home, Spa, Amenities, Personal Training) already use `sr-only` for their SEO H1/intro — those are invisible to users and only read by crawlers/screen readers. So this fix is scoped to **Cafe.tsx**.

## Changes

### `src/pages/Cafe.tsx`

1. **Editorial intro section** (lines 122–143) — convert to `sr-only`. Crawlers still get the H1 + intro paragraph; users see nothing. Drop the city list ("Farmington Hills, Plymouth…") entirely — it's keyword stuffing with no real value.

2. **Menu category descriptions grid** (lines 145–198) — remove from visible UI. Move a single condensed paragraph into the same hidden `sr-only` block so Google still sees "smoothies, protein shakes, açaí bowls, cold-pressed juice, espresso" once. The live `CafeOrderContent` already shows real menu items with prices — that's what users should see.

3. **FAQ section** (lines 204–216) — keep visible (FAQs are genuinely useful + power the FAQPage JSON-LD), but rewrite the FAQ copy in `cafeFaqs` (lines 8–40) to brand voice: remove "near me", remove the Detroit-metro city dump, remove "best protein shake near me" phrasing. Questions stay informative ("Is the café open to non-members?", "Do you have dairy-free options?", etc.).

4. **"After the café, recover" cross-link section** (lines 219–238) — keep, but tighten copy and drop "in Livonia" from the visible line.

5. **JSON-LD** (lines 41–105) — keep as-is. Schema.org data isn't visible and is the correct place for location/keywords.

### Verification pass on the other pages

Re-read Home, Spa, Amenities, Personal Training and confirm no visible keyword-stuffed paragraphs slipped in. Current state:
- Index.tsx — H1 is `sr-only`, visible copy is brand philosophy. Good.
- Spa.tsx — H1 + intro are `sr-only aria-hidden`. Good.
- Amenities.tsx — H1 is `sr-only`. Good.
- Personal Training Overview — H1 is `sr-only`, visible hero is brand voice. Good.

No edits needed there — just confirming.

### Alt text

Alt text isn't rendered on screen (only read by screen readers / shown on broken images), so it doesn't affect the "premium look." I'll leave the descriptive alts in place but trim gratuitous ", Livonia, MI" tails from a few where it reads forced. Low priority.

## Out of scope

- No changes to `<SEOHead>` titles/descriptions, JSON-LD, sitemap, or canonical tags — those are head metadata, never visible.
- No new pages or content marketing.
- Performance/contrast findings — separate track.

## Result

Cafe page returns to the clean café look. All SEO signal (H1, descriptive intro, category keywords, FAQ schema, JSON-LD) still ships to Google via `sr-only` + head tags + structured data — just nothing screaming "SEO" at the visitor.
