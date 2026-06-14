# Full Search Enhancement Implementation Plan

Implement every Google-supported structured-data enhancement applicable to Storm Wellness Club, plus the supporting metadata and crawlability infrastructure required for each to actually appear in search results. Nothing optional skipped.

## Scope: enhancements being added

1. **LocalBusiness / HealthClub schema** (sitewide, in `index.html`)
   - Full NAP (name, address, phone), geo coordinates, opening hours, price range, payment methods accepted, logo, image, sameAs (Instagram, Facebook), areaServed (Livonia + 8 surrounding cities), department info if any.
   - Enables Maps eligibility, knowledge panel, hours/phone in results.

2. **Organization schema** (sitewide)
   - Legal name, URL, logo, contactPoint (customer service phone/email), sameAs social profiles.

3. **WebSite schema with SearchAction** (sitewide)
   - Enables sitelinks search box in Google results pointing at `/schedule` or `/blog` search.

4. **BreadcrumbList schema** (every non-home page)
   - Replace flat URL in SERP with breadcrumb trail. Extend the existing breadcrumb pattern from `ServiceLandingPage.tsx` to: spa pages, class pages, membership pages, personal training, cafe, blog posts, kids care.

5. **Service schema** (every service page)
   - Already partially present on spa subpages and PT pages. Audit + add to: `/memberships`, `/classes` (Pilates, Cycling, Yoga as individual `Service` blocks), `/kids-care`, `/cafe` if treated as service, `/personal-training/*`, all `/spa/*` subpages confirmed.

6. **FAQPage schema** (every page with a Q&A section)
   - Audit existing FAQ blocks (`/faq`, spa pages, PT pages, memberships) and ensure each renders FAQPage JSON-LD. Add FAQ sections + schema where natural (memberships, classes, kids care, cafe).

7. **Product / Offer schema**
   - Membership tiers as `Product` with `Offer` (price, priceCurrency USD, availability, priceValidUntil).
   - Class passes as `Product` with offers (single $25/$30, multi-packs).
   - Personal training packs from `pt_packs` table — already rendered, add `Product`+`Offer` JSON-LD per pack.
   - Storm Shop merch — `Product` per item with price, availability, brand.

8. **Event schema** (class schedule)
   - One `Event` (`EventStatus`, `EventAttendanceMode: OfflineEventAttendanceMode`) per upcoming class session on `/schedule` and `/classes/:type`. Includes startDate, endDate, location (HealthClub), offers, performer (instructor), maximumAttendeeCapacity, remainingAttendeeCapacity.
   - Eligible for Google's event experience in search and Google Events.

9. **Review / AggregateRating schema**
   - Class types: aggregate from `get_all_class_type_ratings` RPC → `AggregateRating` on each `/classes/:type` page and on the related `Service`.
   - Spa services: from `useSpaReviews` → `AggregateRating` on each spa page.
   - Enables star ratings in SERP.

10. **Article / BlogPosting schema** (every blog post)
    - headline, image, datePublished, dateModified, author, publisher (Organization), mainEntityOfPage.

11. **ImageObject** in critical schemas
    - Provide `image` array (1x1, 4x3, 16x9) per Google guidelines on Article, Product, Event, LocalBusiness.

12. **VideoObject schema** — only if/where the site embeds video. Audit; add where present (homepage hero video if any, spa pages with video).

13. **Logo** (Organization.logo) — explicit absolute URL, ≥112×112, on transparent or solid background.

14. **MenuItem / Menu schema** (`/cafe`)
    - Cafe menu items as `Menu` → `MenuSection` → `MenuItem` with name, description, price, suitableForDiet, nutrition (calories already shown).
    - Eligible for Google's restaurant menu experience.

15. **Speakable schema** (blog posts, FAQ) — marks sections for voice-assistant readout.

16. **HowTo schema** — only if any page contains step-by-step instructions (e.g., "how to book a class"). Audit; add to onboarding/help pages if appropriate.

## Supporting work (required for the above to actually appear)

A. **Sitemap audit + dynamic regeneration**
   - Convert `public/sitemap.xml` (static) to `scripts/generate-sitemap.ts` running on `predev`/`prebuild`.
   - Include: all static routes from `App.tsx` (home, /memberships, /classes, /schedule, /spa, /spa/*, /personal-training, /personal-training/*, /cafe, /kids-care, /blog, /blog/:slug, /class-passes, /faq, /privacy, /terms, /sms-terms, /sms-opt-in-proof).
   - Dynamic: one entry per published blog post, per active class type, per spa service, per PT pack page, per storm shop product.
   - Exclude all `/admin/*`, `/portal/*`, `/member/*`, `/kiosk/*`, `/auth*`, `/reset-password`, `/update-password`, `/site-audit`, `/not-found`.
   - lastmod from DB `updated_at` where available.

B. **robots.txt**
   - Keep current allow-all. Explicitly `Disallow:` the private route prefixes above so crawl budget isn't wasted on auth-walled pages.

C. **Per-route head metadata audit**
   - Every public route needs a unique `<title>`, `<meta description>`, self-referential `canonical`, `og:title/description/url/image`, `twitter:card`.
   - `SEOHead` already exists — audit every public page imports it with correct values. Add to pages missing it.

D. **Open Graph image strategy**
   - Currently using `/pwa-512x512.png` (logo) as default. Generate per-section OG images (1200×630) for: home, memberships, spa, classes, cafe, kids care, blog. Per-blog-post OG uses post hero image.

E. **Prerendering for crawlers**
   - Existing `seo-prerender` edge function — audit it covers every route in the sitemap and renders the JSON-LD server-side (not just after hydration). Critical: review-snippet, event, and product enhancements require the JSON-LD in the initial HTML for reliable indexing.

F. **Search Console submission**
   - After deploy: resubmit sitemap, request indexing on the homepage + 10 key landing pages, validate each new schema type in Google's Rich Results Test.

## Technical implementation breakdown

### New files
- `scripts/generate-sitemap.ts` — dynamic sitemap generator (reads Supabase for blog posts, class types, spa services, PT packs, merch).
- `src/lib/seo/schemas.ts` — typed builders: `buildLocalBusinessLd()`, `buildOrganizationLd()`, `buildWebSiteLd()`, `buildBreadcrumbLd(items)`, `buildServiceLd(svc)`, `buildFAQLd(faqs)`, `buildProductLd(product)`, `buildEventLd(session)`, `buildAggregateRatingLd(rating)`, `buildArticleLd(post)`, `buildMenuLd(menu)`, `buildHowToLd(steps)`.
- `src/components/seo/JsonLd.tsx` — wrapper that renders `<script type="application/ld+json">` via Helmet, accepts one or many schemas, deep-merges into `@graph`.
- `src/components/seo/BreadcrumbTrail.tsx` — visual + schema breadcrumb component.
- OG image assets generated into `src/assets/og/`.

### Files updated
- `index.html` — add Organization + LocalBusiness/HealthClub + WebSite/SearchAction JSON-LD blocks. Add sitewide og:image absolute URL.
- `src/components/SEOHead.tsx` — accept optional `image`, `imageAlt`, `noindex`, `jsonLd[]` props; emit `twitter:card=summary_large_image`, `og:image:width/height`, `og:site_name`, `og:locale`.
- `package.json` — add `predev` + `prebuild` hooks calling sitemap generator.
- `public/robots.txt` — add disallow lines for private prefixes.
- Every public page component — wire `SEOHead` + schema builders. Specifically:
  - `src/pages/Home` (or Index) — Organization + LocalBusiness already in index.html; add WebSite SearchAction confirmed.
  - `src/pages/Memberships.tsx` — Product+Offer per tier, FAQPage, BreadcrumbList.
  - `src/pages/Classes.tsx` — ItemList of Service (Pilates/Cycling/Yoga/etc).
  - `src/pages/ClassTypeDetail.tsx` — Service + AggregateRating + FAQPage + ItemList of upcoming Events.
  - `src/pages/Schedule.tsx` — ItemList of Event for next 14 days.
  - `src/pages/Cafe.tsx` — Restaurant + Menu schema with all items.
  - `src/pages/spa/*.tsx` — confirm Service+Breadcrumb+FAQ; add AggregateRating from spa reviews.
  - `src/pages/personal-training/*.tsx` — add Product+Offer per pack, AggregateRating if available.
  - `src/pages/FAQ.tsx` — FAQPage schema for the full list.
  - `src/pages/Privacy.tsx`, `Terms.tsx`, `SmsOptInProof.tsx`, `sms-terms` — basic metadata + Breadcrumb only.
  - Blog list page — ItemList of BlogPosting.
  - Blog post page — BlogPosting/Article + Breadcrumb + Speakable.
  - Storm Shop list — ItemList of Product.
  - Storm Shop product — Product + Offer + AggregateRating if reviews exist.

### Data the schemas need (must confirm before populating)
- Exact business **legal name** for Organization (Storm Wellness Club LLC?).
- **Public phone number** for LocalBusiness contactPoint.
- **Opening hours** week-by-week.
- **Price range** (`$`, `$$`, `$$$`).
- **Geo coordinates** for 18340 Middlebelt Rd (will geocode if not provided).
- **Social profile URLs** (Instagram, Facebook, TikTok, YouTube) for `sameAs`.
- **Founding date** for Organization (optional but recommended).

### Validation
For every schema type added: run the page URL through Google's Rich Results Test and Schema.org validator before claiming complete. Document results in a checklist.

## Order of execution (so each phase is independently verifiable)

1. Confirm business data (questions to user — see "Data needed").
2. Schema builder library + `JsonLd` component.
3. Sitewide schemas in `index.html` (Organization, LocalBusiness, WebSite).
4. Dynamic sitemap + robots updates.
5. Per-route metadata + Breadcrumb + Service/FAQ on every existing public page.
6. Product/Offer (memberships, class passes, PT packs, merch).
7. Event schema (schedule, class type pages).
8. AggregateRating (classes, spa).
9. Article schema (blog).
10. Menu schema (cafe).
11. OG image generation per section.
12. Prerender audit to ensure JSON-LD ships in initial HTML.
13. Rich Results Test validation pass for each type.
14. Search Console: resubmit sitemap, request indexing on key URLs.

## Out of scope (explicitly)
- No business-logic, billing, RPC, RLS, or admin UI changes.
- No design/visual changes other than rendering breadcrumb component on pages that lack one.
- No new pages created solely for SEO (no doorway pages).

## Estimated size
Large. ~25–40 file edits, 3 new files, 1 generator script, ~10 OG images. Will be broken into the 14 phases above and committed phase-by-phase so the user can review progress.

---

**Before implementation begins I need the data in "Data the schemas need" above** — I'll ask those as follow-up questions the moment you approve this plan.