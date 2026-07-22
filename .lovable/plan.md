
## Why we need to build this

Right now there is **no admin UI** to manage class pass prices. The prices live in three disconnected places:

1. **Display prices** — hardcoded in `src/pages/ClassPasses.tsx` (`classPassPricing` array: Single $25/$30, 10-Pack $170/$285).
2. **Stripe checkout prices** — hardcoded `price_id`s in `src/lib/stripeProducts.ts` → `STRIPE_PRODUCTS.classPasses` (8 total: pilatesCycling + otherClasses × single + tenPack × member + nonMember).
3. **Legacy `class_pricing` table** — exists in the DB with 4 rows but nothing reads it.

Because Stripe prices are immutable, changing an amount requires creating a **new Stripe price** and swapping the stored `price_id`. This plan builds a single source of truth and a proper admin editor.

## What we'll build

### 1. Rework the `class_pricing` table

Extend it to be the source of truth for all 8 tiles:

- `category` — `pilates_cycling` | `other` (already there)
- `pass_type` — `single` | `10_pack` (already there)
- `audience` — `member` | `non_member` (new; split existing rows)
- `label` — display name shown on the site (e.g. "Single Class", "10 Class Pack")
- `price_cents` — integer (replaces `member_price` / `non_member_price` dollars)
- `stripe_price_id` — current active Stripe price
- `is_active`, `updated_at`

Seed rows from the current hardcoded values so nothing changes on day one:

| Category | Pass | Audience | Price | Stripe price_id |
|---|---|---|---|---|
| pilates_cycling | single | member | $25 | price_1SlA2v… |
| pilates_cycling | single | non_member | $30 | price_1T2XzA… |
| pilates_cycling | 10_pack | member | $170 | price_1SlA9s… |
| pilates_cycling | 10_pack | non_member | $285 | price_1T2Xzf… |
| other | single | member | $20 | price_1T2XmK… |
| other | single | non_member | $30 | price_1SlABF… |
| other | 10_pack | member | $150 | price_1T2YiA… |
| other | 10_pack | non_member | $180 | price_1T2XoI… |

RLS: read for `authenticated` + `anon` (needed for the public pricing page); write for admin roles only.

### 2. New admin page `/admin/class-pass-pricing`

Design mirrors the existing PT Packs admin page for consistency:

```text
Pilates & Cycling
  Single Class            Member $25    Non-member $30    [Edit]
  10 Class Pack           Member $170   Non-member $285   [Edit]

Other Classes (Yoga, etc.)
  Single Class            Member $20    Non-member $30    [Edit]
  10 Class Pack           Member $150   Non-member $180   [Edit]
```

Edit dialog lets the admin change the **member** and **non-member** dollar amounts (and optional label). On save:

1. Call a new edge function `update-class-pass-price` (admin-gated) that:
   - Creates a new Stripe **price** on the existing product for that tier
   - Updates the `class_pricing` row with the new `price_cents` and new `stripe_price_id`
2. Old Stripe prices are left untouched (Stripe requires this — historical charges keep referencing them).

Add a sidebar entry under Class Management: **Class Pass Pricing**.

### 3. Wire the runtime to the DB

- `src/pages/ClassPasses.tsx` — remove the hardcoded `classPassPricing` array and fetch from `class_pricing` (single query, cached with React Query). Falls back to defaults if fetch fails so the page never breaks.
- `supabase/functions/stripe-payment/index.ts` — in both `create_class_pass_checkout` and the admin variant, look up `stripe_price_id` from `class_pricing` instead of `STRIPE_PRODUCTS.classPasses`.
- `src/lib/stripeProducts.ts` — leave the constants as a safety fallback but stop treating them as canonical.

## Out of scope

- No change to Guest Pass, PT Pack, Kids Care, or Membership pricing (those already have their own management or intentionally stay in code).
- No historical repricing — existing purchased passes keep whatever price they were bought at.
- No new pass tiers (e.g. 5-pack) — can add later once the schema is in place.

## Technical details

- Migration adds `audience`, `label`, `price_cents`, `stripe_price_id` columns, backfills from existing rows + hardcoded values, drops the old dollar columns.
- New edge function `update-class-pass-price` uses `assertAdmin` and Stripe API `prices.create({ product, unit_amount, currency: 'usd' })` re-using the existing product IDs already attached to the current price IDs (looked up server-side via `stripe.prices.retrieve`).
- Admin UI: `src/pages/admin/ClassPassPricing.tsx`, edit dialog, route registered in `App.tsx`, sidebar link added.
- `useClassPassPricing` hook powers both the public `/class-passes` page and the admin page from the same source.
