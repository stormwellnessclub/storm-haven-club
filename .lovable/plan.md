## Goals

1. Confirmation popup + email after every class pass purchase (single, 10-pack, MD pack — member and non-member).
2. Mother's Day pack keeps its existing gift flow; regular class passes are NOT giftable (no mixing of MD pricing with regular pricing).
3. Track abandoned/incomplete checkouts; send recovery emails at 1h, 24h, 72h. Credits ONLY granted when Stripe confirms payment.
4. Promo banner on homepage, member portal, non-member portal — Mother's Day until May 12, 2026, then auto-switch to a generic "Gift a class pass" message.
5. Fix the responsive sizing of the class pass purchase cards/buttons on `/class-passes` so they look right on phone, tablet, and laptop.

## Confirmation popup + email (all class pass purchases)

- New `<ClassPassPurchaseSuccessDialog />` shown on `/class-passes` and `/portal/passes` when returning from Stripe with `?purchase=success&session_id=…`.
  - Calls a new edge function `class-pass-confirm` that retrieves the Stripe Checkout Session, verifies `payment_status === 'paid'`, and returns: pass name, classes included, expiry date, amount paid.
  - Acts as a safety net: idempotently upserts the `class_passes` row keyed by `stripe_session_id` if the webhook hasn't landed yet (does NOT duplicate if already present).
  - Branded modal: gold accents, "Your pass is ready", expiry date, primary CTA → `/schedule`.
- New email template `class-pass-confirmation.tsx` registered in `transactional-email-templates/registry.ts`. Sent from `class-pass-confirm` with idempotency key `class-pass-confirm-${session_id}`. Includes pass name, classes, expiry, "Book a class" button.
- Mother's Day pack already has its own modal/email. The new dialog component is reused as the visual shell so the buyer sees one consistent branded popup whether buying MD pack or regular passes (existing MD email flow stays intact).

## Abandoned-checkout tracking + recovery emails

New table `pending_class_pass_checkouts`:
- `id`, `user_id` (nullable for guests), `email`, `name`, `stripe_session_id` (unique), `stripe_payment_intent_id`, `product_kind` ('class_pass' | 'mothers_day_pack'), `category`, `pass_type`, `is_member`, `is_gift`, `gift_recipient_email`, `amount_cents`, `status` ('pending' | 'completed' | 'expired' | 'recovered'), `reminders_sent` (0–3), `last_reminder_sent_at`, `created_at`, `completed_at`. RLS: admin read, service-role write.

Wiring:
- `stripe-payment` `create_class_pass_checkout` and `mothers-day-pack-create-intent` insert a `status='pending'` row BEFORE returning the Stripe URL/clientSecret.
- `stripe-webhook` on `checkout.session.completed` / `payment_intent.succeeded` for class passes / MD pack: mark the matching row `completed`. Credit-granting code paths are UNCHANGED — credits remain gated on the existing webhook fulfillment branches.
- New edge function `process-abandoned-class-pass-checkouts` scheduled via pg_cron every 15 min:
  - Sends recovery email when age matches one of: ≥1h (`reminders_sent=0`), ≥24h (`reminders_sent=1`), ≥72h (`reminders_sent=2`).
  - Skips if a completed pass for the same SKU exists for the user/email (avoids spam after manual retry).
  - After 7 days pending → mark `expired`, no further emails.
- New email template `class-pass-abandoned-checkout.tsx` with a "Finish your purchase" CTA back to `/class-passes` (and `/class-passes#mothers-day` for MD pack).
- Admin: new tab/page `Abandoned Class Pass Checkouts` under Membership Management showing pending rows, filter by 1h/24h/72h/expired, "Resend now" and "Mark recovered" actions.

## Mother's Day pack gift flow (unchanged)

Already supports gifting + recipient redemption + admin tracking from prior work. No logic changes. Only visual: confirmation modal on MD pack purchase reuses the new `ClassPassPurchaseSuccessDialog` shell. Regular passes do NOT get gifting.

## Promo banner (homepage + both portals)

New `<PromoBanner />` component:
- Homepage: slim full-width strip directly under the navbar.
- Member portal layout: top of dashboard.
- Non-member portal layout: top of dashboard.
- Behavior driven by `America/Chicago` clock:
  - Until end-of-day May 12, 2026 → "🌷 Mother's Day Class Pack — gift 10 classes for $200 (members) / $300 (non-members)" → `/class-passes#mothers-day`.
  - After May 12 → "🎁 Gift a 10-class pack to a Storm Wellness Club member" → same anchor.
- Dismissible per session via `sessionStorage`.

## Responsive sizing fix on `/class-passes`

`MothersDayClassPackSection.tsx` and the regular pass cards on `ClassPasses.tsx` currently overflow / mis-size at narrow widths. Tighten:
- Pass card grid: `grid-cols-1 md:grid-cols-2` with `gap-4 md:gap-6 lg:gap-8`, max-width container, consistent `min-h` so member/non-member cards align.
- Price typography: clamp font sizes (`text-3xl sm:text-4xl md:text-5xl`) so prices don't wrap or push the card.
- Buy buttons: `w-full` on mobile, auto on `sm`+, with consistent height (`h-11`) and padding; loading state spinner centered.
- "Buy as a gift for a Storm Wellness Club member" button wraps cleanly on small screens (truncate with `whitespace-normal text-center leading-tight`).
- Verify at 375px (phone), 768px (tablet), 1280px (laptop), 1536px (desktop) using the preview viewport tool — capture screenshots before/after.

## Files

**New**
- `src/components/class-passes/ClassPassPurchaseSuccessDialog.tsx`
- `src/components/marketing/PromoBanner.tsx`
- `src/pages/admin/AbandonedClassPassCheckouts.tsx`
- `supabase/functions/class-pass-confirm/index.ts`
- `supabase/functions/process-abandoned-class-pass-checkouts/index.ts`
- `supabase/functions/_shared/transactional-email-templates/class-pass-confirmation.tsx`
- `supabase/functions/_shared/transactional-email-templates/class-pass-abandoned-checkout.tsx`
- DB migration: `pending_class_pass_checkouts` table + RLS + pg_cron schedule

**Edited**
- `src/pages/ClassPasses.tsx` — wire up success dialog, fix responsive sizing of pass cards
- `src/components/marketing/MothersDayClassPackSection.tsx` — fix responsive sizing
- `src/pages/portal/Passes.tsx` — wire up success dialog
- `src/pages/Index.tsx` — render `<PromoBanner />`
- Member + non-member portal layouts — render `<PromoBanner />`
- `supabase/functions/stripe-payment/index.ts` — insert pending row in `create_class_pass_checkout`
- `supabase/functions/mothers-day-pack-create-intent/index.ts` — insert pending row
- `supabase/functions/stripe-webhook/index.ts` — mark pending row `completed` on success (credit logic unchanged)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register two new templates
- `src/components/admin/AdminSidebar.tsx` — link to abandoned checkouts page
- `src/App.tsx` — route for abandoned checkouts admin page

## Guarantees

- Credits granted ONLY in existing `stripe-webhook` `class_pass` and `mothers_day_class_pack` fulfillment branches. Pending-row inserts and recovery emails never touch credit code.
- `class-pass-confirm` re-verifies payment with Stripe before showing success or sending email — URL crafting cannot trigger a fake confirmation.
- Idempotency keys on every email send and DB upsert prevent duplicates across webhook + confirm + cron paths.
