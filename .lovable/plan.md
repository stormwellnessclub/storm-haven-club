# Post-Publish SEO Activation

Now that the site is live with the verification meta tag and IndexNow key file, finish the indexing push.

## 1. Confirm verification meta tag is live
Curl `https://stormwellnessclub.com/` and grep for `google-site-verification` to confirm the deploy went through. Same for `/2d295840bc66b45b896b043774059206.txt` (IndexNow key file).

## 2. Re-submit sitemaps (now that publish landed)
Re-ping the GSC Sitemaps API for both `https://stormwellnessclub.com/` and `https://www.stormwellnessclub.com/` properties pointing at `/sitemap.xml`. Confirm `lastDownloaded` populates.

## 3. Request indexing for top 10 pages via GSC URL Inspection API
Submit one-off indexing requests for the highest-value routes:
`/`, `/memberships`, `/apply`, `/class-passes`, `/spa`, `/schedule`, `/cafe`, `/personal-training`, `/kids-care`, `/guest-pass`

## 4. Fire IndexNow bulk ping
Hit the new `indexnow-ping` edge function with the default 24-URL payload so Bing/Yandex pick up the full set immediately.

## 5. Diagnose & fix the pre-render gap (biggest blocker)
Previously confirmed: `curl -A Googlebot https://stormwellnessclub.com/` returns the empty SPA shell — Googlebot is not getting routed to the `seo-prerender` edge function. Without this fix, indexing requests will still show thin/empty content.

Investigate:
- Check how the custom domain is wired (Lovable hosting → does it support a CDN bot-routing rule?)
- Check `seo-prerender` function for invocation pattern — is anything calling it?
- Options: (a) wire a redirect rule that proxies bot user-agents through the edge function, (b) move to a static prerender script that writes per-route HTML into `dist/` at build time, (c) accept Google's JS rendering and ensure all critical content renders without auth gates.

Will present findings and pick the best option before changing anything.

## 6. Quick crawl-blocker audit
- `grep -r "noindex"` across `src/` to make sure no SEOHead is accidentally setting noindex on public pages
- Verify canonical tags on key pages resolve to root domain (not www, not preview)
- Confirm `robots.txt` is reachable at production URL

## 7. Report back
Summary of: verification status, sitemap status, URLs submitted for indexing, IndexNow response, prerender diagnosis + recommended fix.

## Technical notes
- All GSC calls go through `connector-gateway.lovable.dev/google_search_console` with `LOVABLE_API_KEY` + `GOOGLE_SEARCH_CONSOLE_API_KEY`
- IndexNow function is already deployed at `/functions/v1/indexnow-ping`
- No file changes in steps 1-4, 6, 7. Step 5 may require code changes pending diagnosis (will pause for approval before touching prerender routing).
