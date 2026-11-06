# Site-wide search overhaul

Your brief says to finish the full page-by-page map before changing pages, so the work comes in that order.

## What I found so far
- **Hidden keyword text:** the Homepage, Spa and Amenities pages still carry hidden keyword text that visitors never see. Your brief forbids this. It is the biggest risk on the site today.
- **Robot-style titles:** most page titles read like keyword strings, for example "Recovery Spa & Massage Livonia, MI | Aella at Storm" and "Gym & Wellness Memberships in Livonia, MI".
- **Yoga:** the Classes and Schedule titles still mention yoga, which isn't launched.
- **Private pages open to Google:** some utility pages can still be indexed, including card saved, reservation confirmed, invoice payment, event portal and voucher redemption.
- **Sitemap:** it lists 87 pages and needs checking against the pages that should actually rank.
- **Your brief's map:** it mentions pages for yoga, strength classes, Moroccan clay and hot stone. None of these exist on your live schedule or menu, so I won't create them.

## Step 1: the master map (delivered first, no page changes)
A spreadsheet with one row for every public page. Each row shows:
- the page's job, the searches it should win and the visitor's stage
- the action we want the visitor to take
- the current and recommended Google title, description and main heading
- whether Google should index it, what it links to and what links to it
- overlaps with other pages and gaps

I'll use real search data for Livonia-area searches to rank priorities. You review it before anything changes.

## Step 2: safe fixes, after you approve the map
- Remove all hidden keyword text. Real facts like the address and hours stay in a short visible "Visit" block.
- New titles and descriptions for every page, in the pattern "Reformer Pilates in Livonia | Storm Wellness Club".
- One clear main heading per page. Your brand headlines stay.
- Hide all utility, payment, confirmation and voucher pages from Google.
- Clean up the sitemap and robots file. Search filter and date links point Google to one main page.
- Accurate business details for Google: Storm Wellness Club with Spa Aella and Storm Wellness Café as parts of it, at the same address. Breadcrumbs on every page. No self-awarded star ratings.
- Image file names and descriptions that say what the photo shows. Proper share images per page.

## Step 3: service pages, only where there's real substance
- Spa Aella: massage, facials, body treatments and recovery category pages, plus pages for the Seaweed ritual and the main recovery treatments (red light, cryo, sauna). Each will explain what happens, careful benefits, and who should check with a doctor first.
- Classes: Reformer and Cycling pages tied to the schedule.
- Links between pages in natural places, such as Classes to Personal Training and Spa to Body Treatments.
- No near-copy pages for each nearby city. Nearby towns are mentioned once, on a visit section.

## Needed from you
- Your Google Business Profile details (exact name, phone, hours, categories) so the site matches them exactly.
- Confirm the phone number and hours, especially café and spa hours, to show on the site.

## Technical details
- The map goes to /mnt/documents/Storm_SEO_Master_Map.xlsx, built from `src/App.tsx` routes, `SEOHead` props, `public/sitemap.xml` and `robots.txt`, plus Semrush data for the us database.
- `SEOHead` gets a `noindex` prop for utility routes. The `seo-prerender` output is checked to match what visitors see.
- Structured data uses Organization/HealthClub plus DaySpa and CafeOrCoffeeShop linked by `parentOrganization`, and BreadcrumbList on each page.
