

# Fix All SEO Gaps

Three changes identified in the previous SEO audit.

## 1. Add FAQPage JSON-LD structured data to FAQ page
Inject `FAQPage` schema markup into `src/pages/FAQ.tsx` using a `<script type="application/ld+json">` tag via `Helmet`. This generates the FAQ rich snippet questions directly in Google search results. The data will be built from the existing `faqCategories` array.

## 2. Add social media links to JSON-LD `sameAs` array
Update the `sameAs: []` in `index.html` and `seo-prerender/index.ts` to include Instagram and Facebook URLs. (I'll need you to confirm the handles — I'll use `stormwellnessclub` for both unless you say otherwise.)

## 3. Update sitemap lastmod dates
All `lastmod` entries in `public/sitemap.xml` are stale (2026-03-17). Update them to today's date (2026-03-26).

## Files to change
- **Edit**: `src/pages/FAQ.tsx` — add FAQPage JSON-LD via Helmet
- **Edit**: `index.html` — populate `sameAs` array with social links
- **Edit**: `supabase/functions/seo-prerender/index.ts` — add `sameAs` to JSON-LD
- **Edit**: `public/sitemap.xml` — update lastmod dates

