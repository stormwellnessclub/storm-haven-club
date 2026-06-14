## The real problem I just uncovered

When Googlebot crawls **any** page on your site — `/cafe`, `/spa`, `/spa/red-light-therapy`, anything — it receives the **homepage's** title, meta description, and canonical URL. I just proved this with a `curl` impersonating Googlebot:

| URL crawled | Title Google sees | Canonical Google sees |
|---|---|---|
| `/` | "Storm Wellness Club \| Premium Fitness…" | `https://www.stormwellnessclub.com/` |
| `/cafe` | **same as homepage** | **points to homepage** ❌ |
| `/spa` | **same as homepage** | **points to homepage** ❌ |
| `/spa/red-light-therapy` | **same as homepage** | **points to homepage** ❌ |

This is why none of last week's cafe/spa rewrites moved rankings — **Google never saw them.** A `seo-prerender` edge function exists in the project (23KB, written months ago) but **it is not actually intercepting Googlebot requests** — Cloudflare serves the static `index.html` shell and Google's crawler doesn't execute the JavaScript that would replace those tags via `react-helmet-async`. Plus the canonical points at `www.` which then 302-redirects to non-`www`, telling Google "the real page is somewhere else" on every single URL.

Until this is fixed, **nothing else matters.** Cafe rewrites, spa keyword targeting, GSC verification, sitemap submission, FAQ schema — Google sees one page (the homepage) for every URL we have.

---

## Plan — 5 phases, ordered by impact

### Phase 1 · Make Google actually see the per-page content *(blocks everything else)*

**1a. Diagnose and fix the prerender pipeline.**
- Read `supabase/functions/seo-prerender/index.ts` to understand what it does.
- Determine why it isn't intercepting requests: most likely a Cloudflare Worker / redirect rule pointing Googlebot's user-agent at the edge function is missing, or the function was never wired to the custom domain.
- Two options to wire it up: (A) Cloudflare Worker that detects bot user-agents and proxies to the edge function, or (B) switch the static-file mechanism so the edge function handles all `/spa/*`, `/cafe`, `/spa`, `/mothers-day` requests for bots. I'll pick after reading the function code.

**1b. Fix the canonical URL.**
- `index.html` canonical currently says `https://www.stormwellnessclub.com/`. The `www` subdomain 302-redirects to non-`www`. Change canonical to `https://stormwellnessclub.com/`.
- Same fix in JSON-LD `url`/`logo`/`image` fields and `og:url`.

**1c. Change www → root to a 301 permanent redirect** (currently 302 temporary, which doesn't pass link equity).

**1d. Verify after deploy** by curling 4 URLs as Googlebot and confirming each returns its own title/description/canonical.

### Phase 2 · Google Search Console — done right

**2a. Determine current verification state.** Three possibilities you may not realize:
- You may already be verified via the **Google Analytics method** (same Google account owns both GA4 and GSC → automatic). I can't tell from outside.
- You may have a property registered for `www.stormwellnessclub.com` (which is the wrong canonical) instead of `stormwellnessclub.com`.
- Verification may have lapsed.

**2b. Three questions for you before I write code** (the answers determine the work):
1. When you log into `search.google.com/search-console` right now, which property names appear in the dropdown?
2. Are any of them showing impression/click data in the Performance tab over the last 90 days?
3. Do you remember which verification method Google asked you to use (DNS record at your registrar, Google Analytics, file upload, meta tag)?

**2c. Based on your answers, I'll do one of:**
- **If verified & seeing data:** Skip verification entirely. Submit the updated sitemap in the GSC UI, register the right property (probably both `stormwellnessclub.com` *Domain* property + `https://stormwellnessclub.com` URL property for max coverage).
- **If verified but wrong property:** Add a `Domain` property (covers all subdomains/protocols at once via DNS TXT), submit sitemap.
- **If not verified:** Use the GSC connector to pull a verification token and embed it. We pick the method together — I'm not deciding for you.

**2d. After verification:** I give you a copy-paste list of 11 URLs (`/`, `/cafe`, `/spa`, 8 spa subpages, `/personal-training`) to paste into GSC's "URL Inspection → Request Indexing" tool. Google typically recrawls within 1–7 days vs. 4–8 weeks naturally.

### Phase 3 · Schema markup expansion (the rich snippets that win clicks)

Currently you have `HealthClub`, `CafeOrCoffeeShop`, `BreadcrumbList`, `FAQPage`. Missing high-leverage types:

- **LocalBusiness** with `priceRange`, `openingHoursSpecification`, `paymentAccepted` — drives Google Maps & Local Pack visibility
- **Service** schema on each /spa/* page (red light, cryo, etc.) — eligible for "Service" rich results
- **Product** schema on `/memberships` for each tier with price — eligible for "Product" rich results
- **Event** schema for the class schedule (each class session) — eligible for "Events" rich results
- **Review/AggregateRating** if you have Google/Facebook reviews to syndicate
- **Course** schema on `/classes/:classTypeId` pages
- **MedicalBusiness** subtype on `/spa/massage` (massage therapy is recognized as a health service)

Each one is a 10–30 line JSON-LD block per page that, once Googlebot can see it (Phase 1), unlocks rich snippets in search results — bigger, more clickable listings.

### Phase 4 · Content & on-page SEO depth

This is where I expand on what Cafe/Spa rewrites began, now that Google can actually read them:

- **`/spa/*` pages:** Add condition-targeted content sections — "Red Light Therapy for **muscle recovery**," "Cryotherapy for **inflammation**," "Sauna for **detox**." These are the long-tail queries with 200–800/mo volume that actual customers search for. Currently the spa pages target service names, not customer problems.
- **`/personal-training` and subpages:** Currently have no SEO H1/meta strategy at all. Should target "personal trainer Livonia," "private Pilates trainer near me," "semi-private fitness training."
- **`/memberships`:** Should target "gym membership Livonia" (your highest-converting commercial term).
- **`/classes/:classTypeId` (18 dynamic class detail pages):** Currently have no per-class metadata. Each should target "[class type] near me" + "[class type] Livonia."
- **New `/blog` or `/journal` section** — single biggest long-term lever for organic traffic. Topics: "What is red light therapy?", "Reformer Pilates for beginners," "How often should you cold plunge?". I'd propose 6 starter posts with publish cadence, all using the existing brand voice.
- **`/cafe`:** Add a "Menu" subpage at `/cafe/menu` with each item as its own indexable section (smoothie names are searchable: "açaí bowl with peanut butter" etc.).

### Phase 5 · Off-page signals & tracking (this is where you'll see traffic compound)

- **Google Business Profile (GBP) audit.** GBP is what wins the Local Pack — the 3 results that appear above organic for "gym near me." Confirm it's claimed, photos uploaded, hours match, every category set, weekly posts active, all 9 services listed with descriptions, Q&A populated. **GBP is 60% of local SEO. If yours is half-filled, the on-page work is throttled.** I can't access GBP from here, but I can give you a 22-point checklist to walk through.
- **Bing Webmaster Tools** — 5-minute setup, same sitemap submission. ~5–8% of US searches. Free customers.
- **NAP consistency** (Name/Address/Phone) — list your business identically on Yelp, Apple Maps, Facebook Places, Foursquare, BBB, Nextdoor Business. Local SEO weighs citation count.
- **Add `/sitemap.xml` reference** to GBP, Yelp, social bios.
- **Schema-tagged reviews on-site** — pull your Google reviews onto the homepage with `Review` JSON-LD so they show as ★ ratings in search results.
- **Internal linking audit** — every page should link to /spa/* services from related contexts (your current pages don't cross-link enough).
- **PageSpeed/LCP fix** — hero image on homepage is slow; this is a confirmed Lighthouse failure. Affects rankings.
- **Set up GSC + GA4 cross-linking** so you can see which queries drive which conversions in GA4.
- **Weekly rescan via the SEO scanner** so we catch regressions.

---

## Technical details

**Phase 1 files I'd touch:** `supabase/functions/seo-prerender/index.ts` (read first, then likely edit), `index.html` (canonical + www fix in JSON-LD), Cloudflare configuration (may require user action — depends on what's currently routing requests), `src/pages/Index.tsx` (canonical), and a verification script I'd run after deploy that curls 4 URLs as Googlebot to prove the fix.

**Phase 3 files:** `index.html` (LocalBusiness), `src/pages/spa/*.tsx` (Service schema in each), `src/pages/Memberships.tsx` (Product schema per tier), `src/pages/Schedule.tsx` (Event schema), `src/pages/ClassTypeDetail.tsx` (Course schema), `src/pages/spa/Massage.tsx` (MedicalBusiness).

**Phase 4 files:** `src/pages/personal-training/*.tsx`, `src/pages/Memberships.tsx`, `src/pages/ClassTypeDetail.tsx`, new `src/pages/CafeMenu.tsx`, optionally new `src/pages/blog/*` + DB table.

---

## What I am NOT doing without your input

1. **Picking your GSC verification method** — that depends on what you already have set up.
2. **Touching Google Business Profile** — I have no access. I'll give you the checklist.
3. **Writing blog content** — copy is yours; I'd scaffold the system and propose topics, you approve voice.
4. **Cloudflare DNS or Worker changes** that require your registrar login — I'll prepare the config; you paste it.

---

## What I need from you to start Phase 1 (the only one I can safely begin alone)

**Just say "start Phase 1"** and I'll read the `seo-prerender` function, diagnose why it isn't running for Googlebot, and propose the specific fix (which may require a Cloudflare config change from you, or may be fixable purely in code — depends on what I find). Phase 1 is the blocker for everything else, so it's the right place to begin.

For Phases 2–5, I'll wait for your answers to the GSC questions and your "yes/no/modify" on each phase. No more rushing.
