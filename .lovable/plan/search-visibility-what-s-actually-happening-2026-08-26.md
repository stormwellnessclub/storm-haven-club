# Search visibility: what's actually happening

Good news first — your pages **are** indexed. I checked Google directly:

- Sitemap: submitted, last read by Google Aug 19, **0 errors, 0 warnings**, 85 URLs.
- `/spa` — "Submitted and indexed", crawled Aug 19.
- `/spa/massage/prenatal` — "Submitted and indexed", crawled Jul 16.
- **68 different pages** showed up in Google results in the last 28 days, including `/cafe`, `/memberships`, `/guest-pass`, `/amenities`, `/events`, `/schedule`, `/shop`, `/personal-training`, `/gut-reset`, and most spa service pages.
- `robots.txt` allows crawling of everything public.

Note: the "Indexed: 0" number Google shows next to a sitemap is a known dead field — it always reads zero and doesn't mean anything.

## The real problem

Interior pages get impressions but almost no clicks:

| Page | Impressions | Clicks | CTR |
|---|---|---|---|
| Home | 9,284 | 951 | 10.2% |
| /cafe | 2,220 | 43 | 1.9% |
| /spa | 2,366 | 11 | 0.5% |
| /memberships | 2,037 | 41 | 2.0% |
| /amenities | 999 | 5 | 0.5% |
| /events | 1,150 | 4 | 0.3% |
| /classes | 833 | 0 | 0% |
| /shop | 623 | 0 | 0% |
| /personal-training | 557 | 0 | 0% |

Almost all of those impressions come from **brand searches** ("storm wellness club"), where interior pages appear as secondary links and people click the homepage instead. You're barely showing up for the searches that bring in new customers — "massage livonia", "pilates near me", "infrared sauna michigan".

So this isn't an indexing fix. It's a ranking-and-snippet fix.

## Proposed work

**1. Rewrite snippets on the highest-impression pages**
Titles and descriptions for `/classes`, `/shop`, `/personal-training`, `/amenities`, `/events`, `/schedule`, and `/gut-reset` — currently they read like internal page names. Rewrite each around the service plus "Livonia, MI" plus a reason to click (pricing, open to public, book online).

**2. Add real content to thin service pages**
The deeper spa pages rank at position 25–50, which usually means Google sees too little unique text. Expand the ones with actual demand (`/spa/massage`, `/spa/facials/age-defying`, `/spa/facials/customized`, `/spa/body-wraps`) with 300–500 words: what the service is, who it's for, duration, pricing, what to expect, FAQs.

**3. Fix internal linking**
Interior pages currently only get linked from the nav. Add contextual links between related pages (spa hub to each service, classes to schedule to memberships) so Google understands page importance.

**4. Structured data for services**
The site has business and breadcrumb schema, but no Service or FAQ schema on service pages. Adding these makes listings richer and more clickable.

**5. Trim thin auto-generated pages**
Individual `/classes/{id}` pages are in the index with 1–6 impressions each. Recommend keeping them out of the sitemap so crawl attention goes to the pages that convert.

## Technical notes

- Metadata is set per page via a shared SEO component; no build-system change needed.
- `public/sitemap.xml` is a hand-maintained static file — I'll edit it directly.
- Structured data helpers live in `src/lib/seo/schemas.ts` and will be extended, not replaced.
- Nothing here changes the homepage, which is already performing well.
- Ranking changes take 2–6 weeks after publishing to show in Search Console.

## Scope question

This is a fair amount of work. I can do all five, or start with items 1 and 4 (snippets plus structured data) since those are quick and affect every high-impression page. Say which you'd prefer and I'll proceed.
