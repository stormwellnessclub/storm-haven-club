# Structured data: organization, classes, and spa services

The site already has a solid foundation: an Organization + LocalBusiness block in `index.html`, schema builders in `src/lib/seo/schemas.ts`, and Service/FAQ/Breadcrumb blocks on several pages. The gaps are the spa and class pages (no prices, no real classes), inconsistent hand-written blocks, and the crawler prerender which only serves the sitewide business block.

## What changes

### 1. Organization / business (sitewide)
- Point the Organization and LocalBusiness `logo` / `image` at the real branded artwork (gold Storm mark + `/og/og-default.jpg`) instead of the square PWA icon, so knowledge-panel style results have usable imagery.
- Add a service catalog to the business entity listing the main offerings — Reformer Pilates, Indoor Cycling, Yoga, Recovery Spa, Personal Training, Café, Kids Care — each linking to its page.
- Keep `index.html`, `src/lib/seo/business.ts` and the crawler prerender in sync (they are three copies of the same facts today).

### 2. Spa services
- On `/spa`: add a Service block for Aella Recovery Spa plus an item list of the live spa services (name, duration, member and guest price, link to booking) built from the data already loaded on the page, alongside the existing breadcrumbs.
- On each spa service page (massage, facials, body wraps, rituals, recovery, and the standalone red light / cryo / sauna / cold plunge / salt room / Zerobody pages): add pricing offers with duration to the existing Service block, and link the provider to the sitewide business entity by ID rather than repeating the address inline.
- On the spa category hubs: keep the existing item list but give each entry its price and URL.

### 3. Classes
- On `/schedule`: emit Event structured data for the upcoming published sessions shown on the page — class name, start/end time, instructor, location, remaining spots, and drop-in price — using the existing (currently unused) event builder.
- On `/classes/:classTypeId`: keep the Service block and add the upcoming sessions of that class type as Events, plus breadcrumbs.
- Guard against invalid markup: only sessions with a real start time and a public booking URL are emitted, cancelled sessions are marked cancelled, and the list is capped so pages stay light.

### 4. Crawler prerender
`supabase/functions/seo-prerender/index.ts` serves non-JS crawlers and currently emits only LocalBusiness + WebSite. Add per-path breadcrumb and service blocks matching what the React pages emit, so both audiences see the same entities.

## Technical notes
- All new markup goes through the builders in `src/lib/seo/schemas.ts` (`buildServiceLd`, `buildEventLd`, `buildBreadcrumbLd`, `buildProductLd`) and renders via `SEOHead`'s `jsonLd` prop or the `JsonLd` component. Hand-written inline schema objects in `Spa.tsx`, `ServiceLandingPage.tsx`, `SpaCategoryHub.tsx` and `Cafe.tsx` get replaced with builder calls so entity IDs stay consistent.
- Entities reference the sitewide `#organization` and `#localbusiness` IDs so Google can join them into one graph.
- Prices come from the same live data the pages already render — no hardcoded price lists that can drift.
- Validation: build/typecheck, then check the rendered head of `/spa`, `/schedule` and a spa service page in the local preview, and confirm the prerender output for the same paths.

Structured data affects search results only after Google recrawls, so results appear over the following weeks; publishing is required for any of it to reach crawlers.
