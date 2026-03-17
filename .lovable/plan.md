

## Problem: Google Can't Index Your Site

Your website is a Single Page Application (SPA) built with React. When Google's crawler visits any page, it sees an empty `<div id="root"></div>` and a script tag -- no actual content. While Googlebot can execute JavaScript, it deprioritizes JS-rendered content and often fails to index SPAs properly. You also have:

- No per-page meta tags (every page shares the same generic `index.html` title/description)
- No structured data (Schema.org JSON-LD) for local business, classes, or services
- No `<link rel="canonical">` tags
- OG image uses a relative path (`/pwa-512x512.png`) instead of an absolute URL

## Solution: Pre-rendered SEO + Structured Data

### 1. Add a pre-rendering/SSR proxy for crawlers

Create a backend function (`seo-prerender`) that detects crawler user agents (Googlebot, Bingbot, etc.) and returns fully rendered HTML with correct meta tags for each page. This is a common pattern for SPAs called "dynamic rendering."

The edge function will:
- Accept a `path` parameter
- Return a complete HTML document with the correct `<title>`, `<meta description>`, `<meta og:*>`, canonical URL, and structured data for that specific page
- Include the visible text content of each page in the HTML body so crawlers can index it

### 2. Add JSON-LD structured data

Embed Schema.org structured data in the pre-rendered HTML for:
- **LocalBusiness** — name, address (Dearborn, MI), type (HealthClub/SportsActivityLocation)
- **WebSite** — site name, URL
- **Service** entries for key offerings (Pilates, Cycling, Spa, etc.)

### 3. Update `index.html` with better baseline meta tags

- Add `<link rel="canonical" href="https://www.stormwellnessclub.com/">` 
- Fix OG image to absolute URL: `https://www.stormwellnessclub.com/pwa-512x512.png`
- Add `og:url` meta tag
- Add Twitter `description` meta tag
- Add geo meta tags for local SEO (geo.region, geo.placename)

### 4. Add per-page meta tags with react-helmet-async

Install `react-helmet-async` and add `<Helmet>` tags to each public page component so that when Googlebot does execute JS, it sees correct per-page titles and descriptions. Pages to cover:
- Home, Classes, Schedule, Memberships, Apply, Spa, Cafe, Amenities, Kids Care, Class Passes, Guest Pass, Merch, FAQ, Terms, Privacy

### 5. Update robots.txt and sitemap

- Update the sitemap to include `<lastmod>` dates
- Add the canonical domain URL to the `og:url` and sitemap references

### Summary of changes

| Change | Files |
|--------|-------|
| Install react-helmet-async | package.json |
| Add HelmetProvider wrapper | src/App.tsx |
| Add `<Helmet>` to each public page | ~15 page components |
| Fix index.html meta tags | index.html |
| Create SEO prerender edge function | supabase/functions/seo-prerender/index.ts |
| Add JSON-LD structured data | In prerender function + index.html |
| Update sitemap with lastmod | serve-static edge function |

This approach gives you the best of both worlds: crawlers get fully rendered HTML with structured data, and real users get the fast SPA experience.

