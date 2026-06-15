I understand the priority: this is not just “SEO”; this is local survival/discovery. The plan below separates what I can directly implement in the app from what must be changed in Google Business Profile manually because this project only has Search Console connected, not Business Profile management access.

## Goal
Make Storm more eligible for searches like:
- “massage near me”
- “cafe near me”
- “smoothie near me”
- “juice bar near me”
- “protein shake near me”
- “food near me” where Google considers Storm Café relevant
- “spa near me” / “recovery spa near me”

## What I will implement in the website

### 1. Fix the prerender problem with real static HTML
Googlebot currently receives the generic app shell for service routes. I will add a build-time static prerender system that writes crawlable HTML for key public routes before publish.

Routes to prerender first:
- `/`
- `/spa`
- `/spa/massage`
- `/cafe`
- `/amenities`
- `/personal-training`
- `/personal-training/one-on-one`
- `/personal-training/private-pilates`
- `/personal-training/semi-private`
- `/classes`
- `/schedule`
- `/memberships`
- `/apply`
- `/class-passes`
- `/kids-care`
- `/guest-pass`

Technical approach:
- Add `scripts/prerender-static-html.ts`.
- Add `prebuild` script so this runs before publish builds.
- Generate route-level `index.html` files under `public/<route>/index.html` with unique title, meta description, canonical, OG URL, readable body copy, internal links, and JSON-LD.
- Keep React hydration intact so users still get the live app experience.

### 2. Build local service landing pages, not generic pages
The site already has `/spa/massage` and `/cafe`, but I will strengthen them and add/adjust page-level local intent.

Massage page upgrades:
- “Massage near Livonia, MI” language above the fold.
- Specific modalities: Swedish, deep tissue, sports, prenatal.
- Pricing-range/service-table content where available from existing site content.
- Clear address and service area copy.
- FAQ content that directly matches local queries.
- Links back to `/spa`, booking flow, and related recovery services.

Café page upgrades:
- Treat it as a local café/juice bar/smoothie bar page, not just a gym amenity.
- Stronger copy for: café near me, smoothie bar near me, juice bar near me, protein shake near me, açaí bowl near me, healthy food near me.
- Keep “food near me” carefully positioned as healthy café/light meals/snacks so Google gets the correct intent without pretending Storm is a full restaurant.
- Add explicit public-access wording if the café is open to non-members.

### 3. Add stronger structured data
I will add page-specific JSON-LD for:
- `HealthClub` / `LocalBusiness` sitewide
- `Service` for massage
- `DaySpa` or spa-service schema where appropriate
- `CafeOrCoffeeShop` for Storm Café
- `Menu` / `OfferCatalog` for café categories if menu data is available in the current code/data model
- `FAQPage` for massage and café pages
- `BreadcrumbList` for all service pages
- `WebSite` + `Organization` sitewide

I will reuse existing Storm business data already in the project:
- Name: Storm Wellness Club
- Address: 18340 Middlebelt Rd, Livonia, MI 48152
- Phone: +1-313-286-5070
- Domain: https://stormwellnessclub.com

### 4. Add/repair sitemap coverage
I will update the sitemap to prioritize the local-discovery pages and include the prerendered route list.

Specific changes:
- Keep `https://stormwellnessclub.com` as the canonical domain.
- Ensure `/spa/massage` and `/cafe` are high-priority public URLs.
- Remove or reduce crawl priority for internal/low-conversion utility routes where needed.
- Keep protected routes blocked in `robots.txt`.

### 5. Add internal local-discovery links
I will add crawlable internal links so Google can understand the service relationships:
- Homepage → Massage page
- Homepage → Café page
- Spa → Massage page
- Massage → Spa booking + related recovery services
- Café → recovery/spa pages
- Footer or relevant sections → address/local service links if already consistent with the design

### 6. Post-change submission
After implementation and publish:
- Recheck production HTML with Googlebot user agent.
- Confirm `/spa/massage` and `/cafe` return route-specific crawlable HTML, not only the app shell.
- Re-submit sitemap in Search Console.
- Fire IndexNow for the updated URLs.
- Report exactly what is live and what Google can now crawl.

## Google Business Profile work that still must happen outside the app
I cannot directly edit the Google Business Profile from this project because there is no connected Business Profile integration available. I will still prepare exact copy/instructions for you to apply.

### 7. Google Business Profile category recommendations
I will prepare the exact recommended category/service setup, but you must approve category changes because they affect how Google classifies the business.

Likely recommendations to review:
- Primary category should remain whatever best describes the core business if membership/fitness is primary.
- Add secondary categories where Google allows them, likely around:
  - Spa
  - Massage therapist
  - Cafe
  - Juice shop / smoothie shop if available
  - Personal trainer / gym / fitness center as appropriate

I will not assume the final category order without your approval.

### 8. Google Business Profile services/menu copy
I will produce paste-ready GBP service entries for:
- Therapeutic Massage
- Deep Tissue Massage
- Sports Massage
- Prenatal Massage
- Swedish Massage
- Recovery Spa
- Red Light Therapy
- Cold Plunge
- Infrared Sauna
- Sauna / Steam
- Salt Room
- Smoothies
- Protein Shakes
- Açaí Bowls
- Cold-Pressed Juice
- Coffee / Espresso
- Healthy Snacks / Light Meals

### 9. Review-generation language
I will create a review request script/template that asks real customers to naturally mention the service they used, without incentivizing or manipulating reviews.

Examples:
- “If you loved your massage, it helps us if your review mentions massage and Livonia.”
- “If you visited the café, mentioning smoothies, protein shakes, or açaí bowls helps neighbors find us.”

## What I will not do
- I will not claim this guarantees top ranking immediately.
- I will not fake reviews, fake locations, or stuff keywords unnaturally.
- I will not change business classification assumptions without flagging them.
- I will not replace the current sitemap system with a different mechanism unless it is necessary for the prerender fix and tied directly to this plan.

## Success checks
After build approval and publish, I will verify:
- `curl -A Googlebot https://stormwellnessclub.com/spa/massage` shows massage-specific title, H1, copy, schema, and canonical.
- `curl -A Googlebot https://stormwellnessclub.com/cafe` shows café-specific title, H1, copy, schema, and canonical.
- Sitemap includes the priority local pages.
- Robots does not block public service pages.
- Search Console sitemap submission succeeds.
- IndexNow accepts the updated URLs.