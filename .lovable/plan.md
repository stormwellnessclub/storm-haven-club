
# Per-page SEO rebuild — full coverage, no shortcuts

## Why this plan exists

The previous approach (`scripts/prerender.mjs` writing per-route HTML files into `dist/`) is dead — Lovable hosting serves `index.html` for every path, so those files are never delivered. Every page currently inherits the homepage `<title>`, description, canonical, and JSON-LD when viewed without JS.

`react-helmet-async` is already installed and `HelmetProvider` is already wired in `src/main.tsx`. A few pages (FAQ, ClassTypeDetail, Cafe) already use `<Helmet>`. The job is to do it everywhere — correctly, with real content per page.

Googlebot executes JavaScript, so Helmet's per-route tags will be read for search. Social-preview crawlers (LinkedIn/Slack/Facebook) don't execute JS and will keep using the sitewide `og:*` in `index.html` — that's an acknowledged tradeoff Lovable hosting cannot solve without SSR.

## Phase 1 — Cleanup and foundation

1. Delete `scripts/prerender.mjs` and remove its call from the `build` script in `package.json`. This stops misleading anyone (including future-me) into thinking per-route HTML files are being served.
2. Remove the sitewide `<link rel="canonical">` from `index.html` so per-route canonicals from Helmet are the only one shipped. Leave sitewide `og:*` as the no-JS fallback.
3. Audit `index.html` — keep Organization/WebSite JSON-LD sitewide; remove anything page-specific that leaked in.

## Phase 2 — Deep-content service pages (handwritten copy + rich JSON-LD)

For each page below I'll write unique, keyword-targeted, locally-relevant copy and a page-appropriate JSON-LD block. No template repetition. Each page gets:

- Unique `<title>` (under 60 chars, primary keyword + brand)
- Unique `<meta description>` (under 160 chars, distinct value proposition)
- Self-referencing `canonical` and `og:url`
- `og:title`, `og:description`, `og:type`, `twitter:card`
- Page-specific JSON-LD (type chosen per page, listed below)
- Crawlable in-page body content: H1, intro paragraph, benefits, what to expect, FAQ block, pricing/booking CTA, internal links

### Spa & recovery (deep treatment)
- `/spa` — `HealthAndBeautyBusiness` + `BreadcrumbList`. Overview of all modalities, member pricing, hours, address.
- `/spa/massage` — `MassageTherapy` + `FAQPage` + `BreadcrumbList`. Swedish, deep tissue, sports, prenatal, couples — modalities, durations, pricing, therapist qualifications, what to expect, aftercare, contraindications, booking CTA.
- `/spa/red-light-therapy` — `MedicalTherapy` + `FAQPage`. Wavelengths used, session length, benefits (skin, recovery, mood), evidence summary, member credits, who it's for, contraindications.
- `/spa/cryotherapy` — `MedicalTherapy` + `FAQPage`. Whole-body cryo protocol, temperature, duration, recovery benefits, athlete use cases, safety, who shouldn't use.
- `/spa/infrared-sauna` — `HealthAndBeautyBusiness` + `FAQPage`. Far-infrared specs, session protocol, detox/recovery claims framed honestly, hydration guidance.
- `/spa/cold-plunge` — `HealthAndBeautyBusiness` + `FAQPage`. Water temperature, recommended duration, breathing protocol, who it's for, contraindications.
- `/spa/sauna-steam` — `HealthAndBeautyBusiness` + `FAQPage`. Traditional Finnish sauna + eucalyptus steam, etiquette, session length, member access.
- `/spa/salt-room` — `HealthAndBeautyBusiness` + `FAQPage`. Halotherapy explanation, respiratory/skin benefits framed honestly, session protocol.
- `/spa/zerobody` — `HealthAndBeautyBusiness` + `FAQPage`. Starpool ZeroBody dry-float, sensory deprivation benefits, session length, what to wear.

### Memberships & access
- `/memberships` — `Service` (catalog) + `FAQPage` + `BreadcrumbList`. Every tier (including Diamond for women), monthly dues, annual fee, included credits, benefits, freeze policy summary, application process.
- `/apply` — `Service`. Application steps, what's required, review timeline, link to memberships.
- `/class-passes` — `Product`/`Offer`. Pilates/cycling pass pricing ($25/$30 singles, packs), expiration rules, who can buy.
- `/guest-pass` — `Service`. How guest passes work, pricing, restrictions.

### Classes & training
- `/classes` — `ItemList` of class types + `BreadcrumbList`. Reformer Pilates, cycling, yoga, etc. — class descriptions, capacities (Reformer 8, Cycling 10), instructor approach.
- `/schedule` and `/book` — `Service`. Live schedule overview, how booking works, cancellation policy. `/book` canonical points to `/schedule` (same component, choose one as canonical).
- `/personal-training` — `Service` + `BreadcrumbList`. PT philosophy, trainer roster overview.
- `/personal-training/one-on-one` — `Service` + `FAQPage`. 1:1 sessions, pricing, what's included, session length, packages.
- `/personal-training/private-pilates` — `Service` + `FAQPage`. Private Reformer Pilates, instructor matching, pricing, packages.
- `/personal-training/semi-private` — `Service` + `FAQPage`. 2–4 person groups, pricing, format.

### Wellness Hub & recovery
- `/amenities` — `LocalBusiness` amenities list + `BreadcrumbList`. Full facility tour: studios, recovery, cafe, kids care, locker rooms, parking. (This is the "wellness club" overview page per the user's request.)

### Cafe & kids
- `/cafe` — already has Helmet; expand with `Restaurant` + `Menu` JSON-LD (sourced from `cafe_menu_items` table). Hours, menu categories, ingredient highlights, member ordering perks.
- `/kids-care` — `ChildCare` + `FAQPage`. Age range (4mo–8y), Little Stars/Big Stars groups, pricing ($75/mo for 16 sessions or $40 single), reservation process, what to bring.

### Promotions (kept short)
- `/mothers-day` — `Offer` + landing copy.
- `/mothers-day/redeem`, `/mothers-day-pack-redeem` — `noindex` (transactional landing pages).

### Marketing / informational
- `/faq` — already has Helmet; verify `FAQPage` JSON-LD is complete.
- `/merch` and `/shop` — `Store` + `ItemList`. `/shop` canonical points to `/merch`.

### Legal / utility (light treatment)
- `/terms` — title/description/canonical only, no JSON-LD beyond breadcrumb.
- `/privacy` — same.
- `/sms-opt-in-proof` — same; `noindex` is fine here.

### Auth/account pages
- `/auth`, `/reset-password`, `/update-password`, `/my-bookings`, all `/member/*`, all `/portal/*` — set `noindex` via Helmet. Not for search.

### Internal / admin / kiosk
- `/admin/*`, `/kiosk/*`, `/front-desk`, `/design-system`, `/site-audit`, `/guest-feedback`, `/review/spa/*` — set `noindex` via Helmet.

## Phase 3 — Implementation pattern

To keep this clean and consistent without templating:

1. Create `src/components/seo/SEO.tsx` — a thin wrapper around `<Helmet>` that takes `title`, `description`, `path`, optional `ogType`, optional `noindex`, optional `jsonLd` (array of schema objects). It builds the canonical/og:url from `path`, deduplicates JSON-LD output, and sets `twitter:card`. **This is a structural helper, not a content template** — every page passes its own handwritten copy.
2. For each page above, add `<SEO ... jsonLd={[...]} />` at the top of the JSX and write the page's body content (H1, sections, FAQ markup that matches the FAQPage JSON-LD).
3. Pages where the body already has good copy: only add `<SEO>` and JSON-LD, don't rewrite the UI.
4. Pages with thin bodies (most spa modality pages, currently brief): expand with handwritten sections so the JSON-LD is backed by real on-page content.

## Phase 4 — Sitemap reconciliation

Update `public/sitemap.xml`:
- Remove dynamic class UUID entries that no longer exist; keep the ones that resolve to live class types.
- Confirm every indexable route in the plan has a sitemap entry. Add anything missing (e.g. `/amenities` and `/spa/zerobody` are already there — verify after).
- Bump `lastmod` to today on every edited route.
- Leave `noindex` routes (member/portal/admin/kiosk/auth/redeem) out of the sitemap.

## Phase 5 — Verification (after you publish)

I'll fetch each priority URL with a headless renderer (executes JS so we see Helmet output, not the static shell). Output: a per-URL table showing actual rendered `<title>`, meta description, canonical, og:url, and JSON-LD type. Any URL that's still wrong gets fixed before I report done.

Then I'll:
- Submit the updated sitemap via the Google Search Console connector.
- Trigger the Lovable SEO scanner and address its findings.

## Phase 6 — Followups (separate, after Phase 5 lands)

Discussed earlier but not part of this build:
- Per-city landing pages (`/locations/livonia`, `/plymouth`, etc.) under `LocalBusiness`.
- Massage modality sub-pages (`/spa/massage/swedish`, `/deep-tissue`, etc.).
- Cafe category sub-pages (`/cafe/smoothies`, etc.).

These will be proposed as their own plan once Phase 1–5 is verified live.

## Technical details

- `src/components/seo/SEO.tsx` — new helper component (~60 lines). Accepts typed props, no defaults that would mask missing input — if `title` or `description` is missing, TS errors.
- Files edited: `index.html` (remove canonical), `package.json` (remove prerender from build), `public/sitemap.xml` (refresh), every page listed above (add `<SEO>` and expanded body where noted).
- Files deleted: `scripts/prerender.mjs`.
- No new dependencies. No DB migrations. No edge functions. No new routes.
- No `og:image` per page; sitewide `og:image` in `index.html` stays as the fallback. We can revisit per-page images later if you want.

## Out of scope (will not touch)

- Member/portal/admin/kiosk pages beyond adding `noindex`.
- Backend, billing, Stripe, RLS, edge functions.
- Visual redesign of any page. Body-copy additions to thin spa pages will follow the existing design system (no new components, no new color tokens).
