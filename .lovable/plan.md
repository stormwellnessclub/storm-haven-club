## Goal

Remove all public-facing Mother's Day promotional surfaces — both the 10-class pack sale and the spa massage voucher — so neither promo is sold or advertised anywhere on the site. Keep the underlying routes, redeem flows, and admin tracking pages working so existing buyers can still claim/redeem and staff can manage outstanding vouchers and packs.

## Changes

### Home page — `src/pages/Index.tsx`
- Remove the `<PromoBanner />` render (top of page).
- Remove the `<MothersDayBanner />` render.
- Remove the two unused imports.

### Class Passes page — `src/pages/ClassPasses.tsx`
- Remove the `<PromoBanner />` render near the top.
- Remove the `<MothersDayClassPackSection />` render.
- Remove the two unused imports.

### Spa page — `src/pages/Spa.tsx`
- Remove the entire "Mother's Day Special promo" `<section>` block (the gold gradient banner with the "Buy Gift Voucher" button that navigates to `/mothers-day`).

### Member dashboards
- `src/pages/portal/Dashboard.tsx`: remove the `<MothersDayBanner />` render + import.
- `src/pages/member/Dashboard.tsx`: remove the `<MothersDayBanner />` render + import.

## Explicitly kept (not changed)

- Routes in `src/App.tsx`: `/mothers-day`, `/mothers-day/success`, `/mothers-day/redeem`, `/mothers-day-pack-redeem`, `/admin/mothers-day`, `/admin/mothers-day-class-packs` — all remain so existing buyers can still complete checkout flows in progress, redeem, and admin can manage outstanding vouchers/packs.
- Admin sidebar links, admin pages, hooks, edge functions, DB tables, Stripe products — untouched.
- `MyMothersDayVoucherCard` (shown to users who already own a voucher) — untouched; it only renders when the user actually has one.
- `RedeemVoucherDialog` on spa booking — untouched (still works for anyone holding a code).

## Notes

- No DB migration, no edge function changes, no Stripe changes — this is a pure UI hide.
- The promo components themselves (`PromoBanner`, `MothersDayBanner`, `MothersDayClassPackSection`) are left on disk in case the promo is re-enabled next year; they just stop being mounted anywhere public.
- If you'd later want full deletion (files + routes + admin pages), that's a follow-up — say the word.
