---
name: Mother's Day Class Pack
description: 10-class pack promo ($150 member / $265 non-member) with gift flow, server-side tier resolution, webhook fallback, and orphan-claim trigger
type: feature
---
- Sale ends 2026-05-12T05:00:00Z (May 11 23:59 CT). `promo_code='mothers_day_2026'`.
- Tier resolved server-side via case-insensitive `members.email` match; client receives only `recipient_is_member` boolean.
- `class_passes.user_id` is nullable for unclaimed gifts. `stripe_payment_intent_id` (unique) provides idempotency for `mothers-day-pack-confirm`.
- `auto_claim_mothers_day_packs` trigger on `auth.users` insert links orphan passes by email; `claim_mothers_day_pack(_email)` RPC for explicit claim from `/mothers-day-pack-redeem`.
- `stripe-webhook` handles `payment_intent.succeeded` for `metadata.type='mothers_day_class_pack'` as a safety net (calls confirm function).
- Recipient gift email links to `/mothers-day-pack-redeem?email=...` (NOT generic `/auth`).
- Admin surface: `/admin/mothers-day-class-packs` with stats, filters (pending verify, unclaimed, gift/self, tier), resend email, mark verified, manual assign-to-user actions.
