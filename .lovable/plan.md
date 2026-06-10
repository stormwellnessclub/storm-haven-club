# Personal Training — Plan

## Goal
A new top-level nav tab "Personal Training" with an overview page and dedicated sub-pages for each offering. Each page is marketing content + a "Request a Session" form. No live booking/payment in v1.

## Sub-pages
1. **1:1 Personal Training** — `/personal-training/one-on-one`
2. **Private Pilates (Reformer)** — `/personal-training/private-pilates`
3. **Private Cycling** — `/personal-training/private-cycling`
4. **Semi-Private (up to 4)** — `/personal-training/semi-private`

Overview page: `/personal-training` — hero, 4 service cards linking to the sub-pages, trust/why-train-with-us strip, single CTA to request.

## Navigation
- New top-level `Personal Training` item in the main site `Navigation.tsx`, with a dropdown listing the 4 sub-pages (matches existing nav patterns).
- Mobile nav gets a collapsible "Personal Training" group with the same 4 links.
- Footer link added under services.

## Page structure (each sub-page)
- Hero: serif headline, short subhead, dark overlay image (reusing brand imagery — reformer / cycling / strength shots).
- "What it is" — 2–3 short paragraphs.
- "Who it's for" — 3 bullet cards.
- Pricing block — you'll provide rates; rendered as styled tiers (single session / packs). I'll stub placeholders like `$TBD` until you send numbers.
- "How it works" — 3-step strip (Inquire → Match with coach → Schedule).
- Embedded **Request a Session form** (shared component) — pre-fills the service type.
- FAQ accordion (3–5 Q&A).
- Closing CTA.

Semi-private page additionally calls out the 4-person max and "bring your own group" angle.

## Request-a-Session form
Single reusable component `<TrainingRequestForm service="..." />`:
- Fields: name, email, phone, preferred service (pre-selected, editable), preferred days/times (multi-select chips), experience level, goals (textarea), is-member (yes/no).
- Submits to a new `training_requests` table (admin-only RLS, member can insert their own / anon can insert).
- Sends email notification to admin via existing email infra; confirmation email to requester.
- Surfaces in admin under a new `Training Requests` page (simple list + status: new / contacted / scheduled / closed).

## Design
- Matches brand: dark sections, serif display headlines, gold accents, generous spacing — consistent with homepage/spa pages.
- Hero images: reuse existing photography where possible; flag any gaps so you can supply photos.
- Mobile-first; cards stack; sticky "Request a Session" CTA on scroll for mobile.

## Out of scope (v1)
- Online booking, calendars, or Stripe charges for PT (request-only).
- Trainer bios/listings (can add in v2 once you have headshots/bios).
- Member-portal-side booking flow.

## Technical notes
- Routes added in `src/App.tsx`; pages under `src/pages/personal-training/`.
- Shared layout/section components in `src/components/personal-training/`.
- New table `public.training_requests` (with GRANTs + RLS: anon/auth can INSERT, admins SELECT/UPDATE).
- SEO: `<SEOHead>` per page with localized keywords (Livonia/metro Detroit PT, private reformer, etc.); sitemap entries added.
- Admin page added to existing sidebar under an appropriate group.

## What I need from you
1. Pricing for each of the 4 offerings (single + any packs).
2. Any specific trainer names/specialties to mention (or leave generic for now).
3. Confirm hero photo direction or approve reusing existing site imagery.
