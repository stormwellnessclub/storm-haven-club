# SEO Resume Plan — 3 Phases, Step-by-Step

Each phase ends with a checkpoint so you can review before I move on.

---

## Phase 1 — Post-publish verification (no code changes)

Confirm the prerender + GBP work shipped on June 15 is actually live and re-prime the crawlers.

1. **Verify prerendered HTML is live on production.** Curl each of the 16 prerendered routes (`/`, `/spa`, `/spa/massage`, `/cafe`, `/memberships`, `/apply`, `/classes`, `/schedule`, `/class-passes`, `/personal-training` + 3 children, `/amenities`, `/kids-care`, `/guest-pass`) with a Googlebot user agent. Confirm each response contains the route-specific `<title>`, meta description, canonical, and visible body copy — not the empty SPA shell.
2. **Re-submit both sitemaps to Google Search Console** via the GSC connector for the root and www properties. Confirm `lastDownloaded` updates.
3. **Fire IndexNow bulk ping** to Bing/Yandex for all 16 priority URLs. Confirm HTTP 202.
4. **Audit head tags on production** — pull rendered HTML for the 16 routes, verify canonical and `og:url` self-reference (not pointing at homepage), confirm no stray `noindex`, JSON-LD parses, and the GSC verification meta tag is intact.
5. **Report back** a per-URL pass/fail table. If any URL still serves an empty shell, stop and diagnose before Phase 2.

**Output:** verification report. No file changes.

---

## Phase 2 — Expand prerender coverage

Extend the static prerender to every public route that should be indexable, so nothing crawl-worthy is left as an empty shell.

1. **Inventory public routes.** Read `src/App.tsx` and list every public `<Route>` not already in the prerender. Expected additions:
   - `/spa/red-light`, `/spa/cryo`, `/spa/salt-room`, `/spa/sauna`, `/spa/recovery`, `/spa/zero-body`
   - `/personal-training/*` children not already covered
   - `/storm-shop`, `/storm-shop/*` category landing pages
   - `/wellness-hub`, `/community`, `/about`, `/contact`, `/faq`, `/team`, `/philosophy`
   - Legal pages: `/terms`, `/privacy`, `/sms-terms`, `/waiver-info`
   - Booking/info: `/non-member`, `/non-member/credits`, `/recovery`
   - Verify each is intended for indexing — exclude any admin/portal/auth/booking-flow routes.
2. **Confirm exclusions** with you: there will be routes I'm unsure about (e.g. `/non-member/credits` checkout flow, internal landing pages) — I'll bring the list back for a quick yes/no.
3. **Extend `scripts/prerender.mjs`** `PAGE_META` map: title, description, canonical, OG, Twitter, JSON-LD, and a short crawlable body block for each new route. Reuse Storm business data already in `business.ts`.
4. **Update `public/sitemap.xml`** (or the generator script if one exists) so every prerendered route is listed with a sensible `changefreq`/`priority`. Local-discovery pages get higher priority.
5. **Update `public/robots.txt`** only if needed — confirm nothing crawl-worthy is blocked, nothing portal/admin is allowed.
6. **After publish:** re-run the Phase 1 verification on every new URL, re-submit sitemap, fire IndexNow for the new URLs.

**Output:** expanded prerender + sitemap + verification pass.

---

## Phase 3 — Deeper local SEO content

Targeted content that captures "near me" and Livonia/metro Detroit local search intent. Built in 4 sub-steps so you can stop after any of them.

### 3a. Massage modality landing pages
New routes (and prerendered HTML for each):
- `/spa/massage/swedish`
- `/spa/massage/deep-tissue`
- `/spa/massage/sports`
- `/spa/massage/prenatal`
- `/spa/massage/couples` (if offered — confirm with you)

Each page: keyword-targeted H1 (e.g. "Deep Tissue Massage in Livonia, MI"), 400–600 words of editorial copy, pricing, duration, "what to expect" section, FAQ section, `MassageTherapy` + `FAQPage` JSON-LD, internal link back to `/spa/massage`.

### 3b. "Near me" city landing pages
For metro Detroit cities within 15–20 mi of Livonia (per existing SEO Strategy memory):
- `/locations/livonia`
- `/locations/plymouth`
- `/locations/northville`
- `/locations/farmington-hills`
- `/locations/westland`
- `/locations/canton`

Each page: "[Service] near [City]" focused, drive-time from city center, embedded map link, services overview, local cross-links. JSON-LD: `LocalBusiness` with `areaServed`.

### 3c. Cafe SEO depth
- `/cafe/smoothies`, `/cafe/protein-shakes`, `/cafe/acai-bowls`, `/cafe/coffee` — one page per category with the full menu items inline, prices, ingredients, "open to public" callout.
- `Menu` + `OfferCatalog` JSON-LD on `/cafe`, populated from `cafe_menu_items`.
- Update `/cafe` to cross-link to all category pages.

### 3d. Strengthen internal linking
- Homepage hero/footer: prominent links to `/spa/massage`, `/cafe`, top 3 location pages.
- Spa page: link to every modality + recovery service.
- Massage page: link to each modality.
- Cafe page: link to each category.
- Add a `BreadcrumbList` JSON-LD to every nested route.

**Output:** ~15–20 new indexable pages, deeper internal linking graph, richer structured data. Followed by another verification + sitemap re-submission pass.

---

## Order of execution

1. Phase 1 (verification only) — quick, no risk. **Stop and review.**
2. Phase 2 (expand prerender) — medium scope. **Stop and review.**
3. Phase 3 — built in sub-steps 3a → 3b → 3c → 3d, each followed by publish + verify before moving to the next.

## What I'll bring back to you before doing it

- **Phase 2 step 2:** the route inclusion/exclusion list.
- **Phase 3a:** confirm the massage modalities Storm actually offers (and pricing per modality) before writing copy.
- **Phase 3b:** confirm city list and that drive-time/embedded-map approach is what you want vs. simpler text pages.
- **Phase 3c:** confirm which cafe categories to split out.

## Technical notes

- All prerender additions go through the existing `scripts/prerender.mjs` `PAGE_META` map — same pattern shipped on June 15, no new infra.
- Sitemap edits hit `public/sitemap.xml` (currently a hand-edited static file). I'll keep it static unless you want to migrate to a generator script.
- All GSC + IndexNow calls go through the existing connector gateway / `indexnow-ping` edge function — no new secrets needed.
- Per-route head tags can stay in the prerendered HTML; no need to introduce `react-helmet-async` since the static HTML already wins for crawlers.
- No database migrations. No new edge functions. No new tables.
