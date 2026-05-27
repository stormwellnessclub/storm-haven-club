# Comprehensive SEO Fix

The site already has an `seo-prerender` edge function that serves crawler-friendly HTML to bots. The problem is **(1)** the indexing infrastructure points at the wrong URLs so Google can't find/follow your sitemap, **(2)** there are no dedicated landing pages for the services people actually search for (red light, cryo, infrared sauna, massage types, cafe, individual class types), and **(3)** there's no AI-crawler discovery file.

This plan fixes all three in one pass.

---

## Phase 1 — Indexing infrastructure (quick wins, immediate impact)

1. **`public/robots.txt`** — fix the broken Sitemap directive
   - Change `Sitemap: https://cqzmrdzwgsujgbjqpoxh.supabase.co/...` → `Sitemap: https://stormwellnessclub.com/sitemap.xml`

2. **`public/sitemap.xml`** — rebuild with correct host + every public route
   - Switch all entries from `www.stormwellnessclub.com` → `stormwellnessclub.com` (matches canonical)
   - Add missing static routes: `/book`, `/mothers-day`, `/mothers-day/redeem`
   - Add **dynamic** entries for every class type at `/classes/:classTypeId` (Reformer, Cycling, Yoga, HIIT, Barre, etc.) — generated from the `class_types` table
   - Add new service landing pages from Phase 2

3. **`public/llms.txt`** — new file so ChatGPT, Perplexity, Claude understand the site without parsing the JS shell. Lists every public page with one-line descriptions.

4. **`seo-prerender` edge function** — extend `PAGE_META` map with entries for all new landing pages from Phase 2 so Googlebot sees real HTML with H1s, paragraphs, and local keywords, not a blank React shell.

5. **Canonical host alignment** — `index.html` canonical already points to `stormwellnessclub.com/`. Audit prerender, sitemap, and SEOHead component to all use the same non-www host. Pick one and stick with it (recommend non-www since that's the canonical).

---

## Phase 2 — Dedicated service landing pages (the real fix)

Right now `/spa` is one page covering everything. Google can't rank a page that doesn't exist for "red light therapy Livonia" because you don't have one. Same for cryo, infrared sauna, individual massage types, etc.

Create the following new routes, each with its own `<SEOHead>` (title, description, canonical), structured H1/H2 content, local-SEO copy (Livonia + surrounding cities), service-specific FAQ, JSON-LD `Service` schema, and a prerender entry:

**Recovery / spa services** (split out from `/spa`)
- `/spa/red-light-therapy` — "Red Light Therapy in Livonia, MI"
- `/spa/cryotherapy` — "Cryotherapy in Livonia, MI"
- `/spa/infrared-sauna` — "Infrared Sauna in Livonia, MI"
- `/spa/cold-plunge` — "Cold Plunge in Livonia, MI"
- `/spa/sauna-steam` — "Sauna & Steam Room"
- `/spa/massage` — "Therapeutic Massage in Livonia, MI"
- `/spa/salt-room` — "Salt Room Therapy"
- `/spa/zerobody` — "Starpool ZeroBody Dry Float"

Keep `/spa` as the parent hub page; link out to each detail page. Add a service-grid section on `/spa` so internal links pass authority.

**Class types** (the `/classes/:classTypeId` route already exists — we just need SEO meta on it)
- Wire `<SEOHead>` into `ClassTypeDetail.tsx` so each class type page gets its own title, description, canonical, and `Service` JSON-LD pulled from the class type record
- Prerender map handled per-slug in the edge function (Reformer Pilates, Indoor Cycling, Yoga, HIIT, Barre, Mat Pilates, Bootcamp, Sculpt)

**Cafe** — rewrite `/cafe` SEO meta to target "healthy cafe Livonia", "smoothies & acai bowls Livonia", add menu schema and local copy.

**Amenities** — strengthen `/amenities` for "luxury gym amenities Livonia".

**Local pages** (optional, high-ROI for local SEO)
- `/livonia-gym`, `/farmington-hills-gym`, `/northville-wellness` — light landing pages targeting "[service] near me" queries from neighboring cities. Each links back to `/memberships` and `/apply`.

---

## Phase 3 — On-page SEO polish (existing pages)

- Audit every public page's `<SEOHead>` for: title <60 chars w/ primary keyword, description <160 chars, unique per page, single H1, semantic H2/H3 structure
- Add `BreadcrumbList` JSON-LD to all interior pages
- Add `FAQPage` JSON-LD to `/faq` and to each new service page's FAQ section
- Add `LocalBusiness` JSON-LD on `/` (you already have `HealthClub` — keep both; they stack)
- Image `alt` text audit on hero/service imagery

---

## Phase 4 — Verification + submission

- Confirm Google Search Console is verified for `stormwellnessclub.com` (you said you've crawled — verify the property exists in GSC, not just that Google has seen the homepage)
- Submit the new sitemap URL in GSC
- Use GSC's URL Inspection on 3-5 new service pages and click "Request Indexing"
- Set up a weekly Semrush check to confirm interior pages start appearing

---

## Technical details (for reference)

**Files touched:**
- `public/robots.txt` — fix sitemap line
- `public/sitemap.xml` — regenerate with correct host + all routes (static file; no generator script — matches current pattern)
- `public/llms.txt` — new
- `index.html` — verify canonical host
- `src/App.tsx` — add 8 new spa service routes
- `src/pages/spa/RedLightTherapy.tsx`, `Cryotherapy.tsx`, `InfraredSauna.tsx`, `ColdPlunge.tsx`, `SaunaSteam.tsx`, `Massage.tsx`, `SaltRoom.tsx`, `Zerobody.tsx` — new
- `src/pages/Spa.tsx` — add service-grid linking to detail pages
- `src/pages/ClassTypeDetail.tsx` — add `<SEOHead>` + JSON-LD
- `src/pages/Cafe.tsx`, `Amenities.tsx`, `KidsCare.tsx` — SEO copy + JSON-LD upgrade
- `supabase/functions/seo-prerender/index.ts` — add PAGE_META entries for all new routes; align host to non-www
- `src/components/SEOHead.tsx` — ensure consistent non-www host

**No database changes.** No new tables. All content is static React + prerender map.

**Out of scope (call out if you want any of these later):**
- Blog content engine (you have `/blog` — but it's not in our routes; if it's a separate platform, link to it but don't manage it here)
- Image generation for OG previews per service page (placeholder OG is worse than none — recommend generating real OG images per service in a follow-up)
- Google Business Profile setup (off-platform, but the single highest-ROI local SEO action you can take outside the site)

---

## Expected impact

Within 2-6 weeks of indexing:
- 8-12 new ranking URLs (one per service page)
- Capture "red light therapy livonia", "cryotherapy livonia", "infrared sauna livonia", "[class type] livonia" — all low-competition local keywords with real intent
- Per-page CTR lift from accurate titles/descriptions vs generic homepage snippet
- AI assistants (ChatGPT, Perplexity, Claude) can answer "what does Storm Wellness Club offer?" with structured page list

Want me to start with Phase 1 (quick wins, ~15 min) and then proceed to Phase 2, or do you want all phases shipped in one go?
