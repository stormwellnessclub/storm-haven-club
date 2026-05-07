# Finish Class Pass Purchase Wiring

Complete the remaining pieces from the approved plan.

## 1. Mount purchase success dialog
- `src/pages/ClassPasses.tsx` and `src/pages/portal/Passes.tsx`: read `?purchase=success&session_id=…` from URL, call `class-pass-confirm` edge function, render `ClassPassPurchaseSuccessDialog` with returned details. Strip query params on close. CTA → `/schedule`.

## 2. Place PromoBanner
- `src/pages/Index.tsx` (homepage, below navbar)
- Member portal layout (`src/components/portal/PortalLayout.tsx` or equivalent — top of content)
- Non-member portal layout (top of content)
- Logic already inside `PromoBanner`: Mother's Day copy until May 12, 2026, then generic "Gift a 10-class pack to a Storm Wellness Club member" → `/class-passes#mothers-day`.

## 3. Schedule abandoned checkout cron
- Use `supabase--insert` to register a pg_cron job running `process-abandoned-class-pass-checkouts` every 15 minutes (calls function URL with anon key headers, per Lovable cron pattern).

## 4. Admin "Abandoned Checkouts" page
- New `src/pages/admin/AbandonedClassPassCheckouts.tsx`: table of `pending_class_pass_checkouts` filtered by status (pending / expired / recovered / completed), with "Resend reminder now" and "Mark recovered" actions.
- Add route in `src/App.tsx` and sidebar entry under Class Passes section in `src/components/admin/AdminSidebar.tsx`.

## 5. Register email templates
- Verify `class-pass-confirmation` and `class-pass-abandoned-checkout` are imported and listed in `supabase/functions/_shared/transactional-email-templates/registry.ts`. Add if missing.

## Guarantees (unchanged)
- Credits granted ONLY by existing `stripe-webhook` fulfillment branches.
- `class-pass-confirm` re-verifies `payment_status === 'paid'` with Stripe before showing success or sending email.
- Idempotency keys (`class-pass-confirm-${session_id}`, `class-pass-abandoned-${id}-${stage}`) prevent duplicate emails.

## Files

**New:** `src/pages/admin/AbandonedClassPassCheckouts.tsx`

**Edited:** `src/pages/ClassPasses.tsx`, `src/pages/portal/Passes.tsx`, `src/pages/Index.tsx`, member + non-member portal layouts, `src/App.tsx`, `src/components/admin/AdminSidebar.tsx`, `supabase/functions/_shared/transactional-email-templates/registry.ts`

**DB:** one cron job insert via `supabase--insert`.
