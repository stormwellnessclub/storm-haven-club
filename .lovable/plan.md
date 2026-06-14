# Get stormwellnessclub.com fully indexed by Google + Bing

Goal: register every property type in Google Search Console, submit the sitemap, push instant index notifications, and confirm Googlebot sees pre-rendered HTML so pages actually get indexed.

---

## 1. Google Search Console — verify all property types

I'll register the site three ways so you have full coverage no matter how Google sees the URL:

### A. URL-prefix property: `https://stormwellnessclub.com/`
- Request a META verification token from the GSC API
- Inject `<meta name="google-site-verification" content="..." />` into `index.html` `<head>`
- Call verify → add property to GSC

### B. URL-prefix property: `https://www.stormwellnessclub.com/`
- Same flow. Same meta tag works for both since they resolve to the same HTML.

### C. Domain property: `stormwellnessclub.com` (covers all subdomains + http/https)
- This requires a **DNS TXT record** on your domain registrar.
- I **cannot add DNS records** for you — only you have access to your DNS provider (Cloudflare / GoDaddy / wherever the domain is registered).
- I'll request the TXT token from Google and give you the exact record (name + value) to paste in. Once you confirm it's added, I'll click verify.

After verification, each property is added to your GSC account via API and shows up in your dashboard.

---

## 2. Sitemap submission

For each verified URL-prefix property:
- Submit `https://stormwellnessclub.com/sitemap.xml` (and the www variant) via the GSC Sitemaps API
- This will make the "Sitemaps" report in your console show the file with a "Success" status

I'll also fix a small inconsistency: the `serve-static` edge function still has an old hardcoded sitemap with only 15 routes pointing at `www.`. I'll either retire it or sync it to match `public/sitemap.xml` (40+ routes, root domain). Recommendation: retire the edge-function sitemap since `public/sitemap.xml` is the canonical one.

---

## 3. IndexNow (instant Bing + Yandex notification)

- Generate a 32-char IndexNow key
- Drop `public/<key>.txt` containing the key (Bing's required verification file)
- Create a tiny `supabase/functions/indexnow-ping` edge function that POSTs a URL list to `https://api.indexnow.org/indexnow`
- Wire it into your existing publish/deploy flow so every push pings the major URLs automatically
- Initial bulk submission of all 40+ sitemap URLs right after setup

IndexNow is Bing-led but also feeds Yandex, Seznam, Naver. Google does not consume IndexNow — that's what the GSC indexing API in step 4 is for.

---

## 4. Request indexing for top pages (Google)

After verification, I'll use the GSC URL Inspection API to request indexing for your highest-priority pages:
- `/` (home)
- `/memberships`
- `/apply`
- `/class-passes`
- `/spa`
- `/schedule`
- `/cafe`
- `/personal-training`
- `/kids-care`
- `/guest-pass`

This puts each page in the priority crawl queue (vs. waiting for Google to find them organically).

---

## 5. Pre-render verification

Your site is a React SPA. Google can render JS, but it's slower and lower priority than static HTML. You already have a `seo-prerender` edge function — I'll verify it's actually intercepting Googlebot user-agents and serving pre-rendered HTML for the main routes by:
- Curl-testing 3-4 routes with `User-Agent: Googlebot` and checking the response contains real content (not just the empty `<div id="root">`)
- If it's broken or not catching all routes, fix it

If pre-rendering isn't working, indexing will stall regardless of sitemap submission — this is the most likely root cause of "no pages indexing."

---

## 6. Quick blocker audit

- Scan all page-level `SEOHead` calls for any accidental `noindex` flag (unlikely but cheap to check)
- Verify canonical tags resolve to the root domain (not the preview/lovable.app URL)
- Confirm `robots.txt` doesn't accidentally block anything important (already reviewed — looks clean)

---

## What you need to do during this

1. **Approve this plan** (toggle to build mode)
2. **Add the DNS TXT record** I give you (only required for the Domain property — steps A and B happen fully automatically)
3. **Publish the app** after I add the verification meta tag, so Google can fetch it from the live domain

Everything else runs through the connected GSC API and IndexNow — no manual GSC clicking required.

---

## Technical details

- **GSC integration**: already connected via `google_search_console` connector
- **Verification method**: META tag in `index.html` (the only method that works for Lovable apps — DNS-only for domain property)
- **API endpoints used**:
  - `POST /siteVerification/v1/token` → get meta token
  - `POST /siteVerification/v1/webResource` → verify
  - `PUT /webmasters/v3/sites/{encoded-url}` → add property
  - `PUT /webmasters/v3/sites/{encoded-url}/sitemaps/{encoded-sitemap-url}` → submit sitemap
  - `POST /urlInspection/v1/index:requestIndexing` (if available on your plan; otherwise URL Inspection only)
- **IndexNow endpoint**: `POST https://api.indexnow.org/indexnow` with `{ host, key, keyLocation, urlList }`
- **Files touched**: `index.html` (add verification meta), `public/<key>.txt` (IndexNow key), `supabase/functions/indexnow-ping/index.ts` (new), `supabase/functions/serve-static/index.ts` (sync or retire old sitemap)
