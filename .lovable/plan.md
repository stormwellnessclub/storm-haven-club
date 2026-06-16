## Goal
Every single Aella Spa service gets its own indexable URL with handwritten copy + JSON-LD, plus a category hub page above it.

## URL structure
```
/spa                                  (existing hub — keep)
├── /spa/massage                      (existing — convert to category hub: lists all 9)
│   ├── /spa/massage/storm-signature
│   ├── /spa/massage/deep-relief
│   ├── /spa/massage/sports-performance
│   ├── /spa/massage/lymph-and-flow
│   └── /spa/massage/prenatal
├── /spa/facials                      (NEW category hub)
│   ├── /spa/facials/customized
│   ├── /spa/facials/botanical-bliss
│   ├── /spa/facials/age-defying
│   ├── /spa/facials/detoxifying-purity
│   ├── /spa/facials/hydration-infusion
│   ├── /spa/facials/radiant-glow
│   ├── /spa/facials/vitamin-c-brightening
│   └── /spa/facials/peptide-renewal
├── /spa/body-wraps                   (NEW category hub)
│   ├── /spa/body-wraps/avocado-coconut
│   ├── /spa/body-wraps/body-sculpting
│   ├── /spa/body-wraps/detox-seaweed-charcoal
│   ├── /spa/body-wraps/brightening-vitamin-c
│   ├── /spa/body-wraps/anti-aging-collagen
│   ├── /spa/body-wraps/mud-therapy
│   ├── /spa/body-wraps/hydration-aloe
│   └── /spa/body-wraps/relaxing-chamomile
├── /spa/body-rituals                 (NEW category hub)
│   ├── /spa/body-rituals/root-chakra
│   ├── /spa/body-rituals/sacral-chakra
│   ├── /spa/body-rituals/solar-plexus-chakra
│   ├── /spa/body-rituals/heart-chakra
│   ├── /spa/body-rituals/throat-chakra
│   ├── /spa/body-rituals/third-eye-chakra
│   └── /spa/body-rituals/crown-chakra
└── /spa/recovery                     (NEW category hub linking existing pages)
    ├── /spa/red-light-therapy        (existing — keep)
    ├── /spa/cryotherapy              (existing — keep)
    ├── /spa/infrared-sauna           (existing — keep)
    ├── /spa/cold-plunge              (existing — keep)
    ships rest of recovery already linked: /spa/sauna-steam, /spa/salt-room, /spa/zerobody
    plus NEW: /spa/recovery/sports-stretching
```

**Totals:** 5 new category hubs + 39 new individual service pages = **44 new routes**. Each duration variant (60/90 min) of the same modality merges into one page that describes both options (so "Storm Signature 60" and "Storm Signature 90" share `/spa/massage/storm-signature`).

## Per-page contents (every new page)
1. **`SEOHead`** — unique title, meta description, canonical, JSON-LD: `Service` + `FAQPage` + `BreadcrumbList` (Home → Spa → Category → Service).
2. **H1 + intro** — what the service is, who it's for.
3. **What to expect** — step-by-step session walkthrough.
4. **Benefits** — bullet list of 5–8 evidence-based benefits.
5. **Duration / pricing** — both 60 and 90 min variants where applicable, member vs non-member pricing pulled from `spa_services` table (live).
6. **Add-ons** — relevant items from `spa_service_addons`.
7. **FAQ** — 4–6 questions (matches FAQPage JSON-LD).
8. **CTA** — "Book this service" deep-links to `/spa?service=<id>` which auto-opens the booking dialog (small enhancement to `Spa.tsx` to honor `?service=` param).
9. **Related services** — internal links to 3 siblings in same category.

## Category hub pages
- Hero, category description, full list of every service in that category with short blurb + "Learn more" link to the individual page + "Book" deep-link.
- JSON-LD: `ItemList` of services + `BreadcrumbList`.

## Files to create / modify
- **NEW**: 5 hub files: `src/pages/spa/categories/Massage.tsx` (replaces current generic `Massage.tsx`), `Facials.tsx`, `BodyWraps.tsx`, `BodyRituals.tsx`, `Recovery.tsx`.
- **NEW**: 39 service files under `src/pages/spa/services/<category>/<slug>.tsx`.
- **NEW**: `src/lib/spa-content.ts` — handwritten copy bank (intro, benefits, FAQ) keyed by slug. Keeps page files thin.
- **NEW**: `src/lib/spa-slugs.ts` — slug ↔ DB service name(s) map (handles 60/90 merge).
- **MODIFY**: `src/App.tsx` — register 44 new routes.
- **MODIFY**: `src/pages/Spa.tsx` — honor `?service=<slug>` query to auto-open booking dialog; add "View all categories" navigation block.
- **MODIFY**: `public/sitemap.xml` — append all 44 new URLs.

## Execution order
1. Build slug map + content bank (foundation).
2. Build category hub pages (5).
3. Build individual service pages (39) — generated from a shared `ServicePageLayout` component fed by the content bank, so each file is ~20 lines but renders unique content.
4. Wire routes + sitemap.
5. Add `?service=` deep-link to `Spa.tsx`.
6. Manual spot-check 5–6 pages across categories.

## Out of scope (followups)
- City landing pages (`/locations/livonia`, etc.)
- Cafe sub-pages, classes sub-pages, PT sub-pages — separate plans after spa lands.

## Technical notes
- Live pricing from `spa_services` keeps prices accurate; if the DB is unreachable, page still renders with handwritten copy and a "Pricing in studio" fallback.
- No new dependencies, no migrations, no edge functions.
- All new routes are public (no `NoIndex`).
- Each page's canonical and `og:url` self-reference per head-meta rules.
