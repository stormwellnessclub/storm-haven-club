# Add and Delete Class Pass Pricing Tiers

Today the Class Passes → Pricing tab only lets you edit the dollar amount of the 8 existing tiers. This adds the ability to create brand new tiers and remove ones you no longer sell.

## What you'll be able to do

- **Add a pricing tier** with a button at the top of the Pricing tab. You choose:
  - Category (Pilates & Cycling, Other, Reformer, Cycling, Aerobics)
  - Audience (Member / Non-Member)
  - Pass type (Single, 10 Pack, or a custom pack such as a 5 Pack or 20 Pack)
  - Number of classes included
  - Display label and price
  A matching Stripe product and price are created automatically, so the new tier is immediately sellable.
- **Delete / retire a tier** from a row menu. Two options:
  - Deactivate (hidden everywhere, kept for reporting) — the default and recommended choice.
  - Permanently delete — only allowed when nothing references the tier.
  Passes already sold are never affected.
- **Show inactive tiers** toggle so retired tiers can be reactivated later.

## Important note on custom pack sizes

The public checkout currently understands only "single" and "10 pack" purchases. New custom pack sizes will be fully usable for admin/front-desk sales right away; to also expose them in the member-facing purchase drawer, the drawer needs to render tiers dynamically from the pricing table — included in this plan.

## Technical details

**Database (migration)**
- Add `classes_included int not null default 1` and `display_order int not null default 0` to `public.class_pricing`; backfill 1 for single, 10 for 10_pack.
- Relax `pass_type` to any lowercase slug (keep existing values); enforce uniqueness on `(category, pass_type, audience)`.
- Keep existing RLS/grants; admin writes stay server-side via edge functions.

**Edge functions**
- New `create-class-pass-tier`: admin-only (`requireStaff` with `super_admin`/`admin`), creates a Stripe product + price, inserts the `class_pricing` row, returns it.
- New `delete-class-pass-tier`: admin-only; `mode: "deactivate" | "delete"`. Deactivate sets `is_active = false` and archives the Stripe price/product. Delete first checks for referencing `class_passes` / `pending_class_pass_checkouts` rows and refuses with a clear message if any exist.

**Frontend**
- `src/pages/admin/ClassPassPricing.tsx`: "Add tier" dialog, per-row dropdown (Edit label, Deactivate, Delete), "Show inactive" switch, grouping updated to include new categories/pass types.
- `src/hooks/useClassPassPricing.ts`: expose `classes_included`, `is_active`, sort by `display_order`.
- Purchase paths (`BuyPassesDrawer` and the `stripe-payment` class-pass branch) resolve the tier row by id and use `classes_included` instead of hardcoded 1 / 10.
