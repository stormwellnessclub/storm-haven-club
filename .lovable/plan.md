## Issue

Fatima Naji (member `b9619bc5-6477-4ab8-b0fd-becee2787178`, user `00874c40-458a-41db-a74a-bd5f831473ee`, email `fanaji72@gmail.com`) paid `$154.79` on Stripe for the **Member Mother's Day Class Pack (10 classes)** — `pi_3TUd3gLyZrsSqLhs1ONhpbuV` — but no row exists in `class_passes` for this payment intent. The fulfillment edge function never wrote the pass.

## Fix

**Step 1 — Try the idempotent confirm function first.**
Invoke `mothers-day-pack-confirm` with `payment_intent_id = pi_3TUd3gLyZrsSqLhs1ONhpbuV`. If the PI carries the expected metadata (`promo=mothers_day_2026`, `type=mothers_day_class_pack`, tier, buyer email), the function will create the `class_passes` row, link it to Fatima (member found by email match), and send the confirmation email. This is the cleanest path and matches every other pack.

**Step 2 — Manual fallback (only if Step 1 fails because metadata is missing).**
Insert a row directly into `class_passes` mirroring the shape used by every other Mother's Day pack:

- `user_id` = `00874c40-458a-41db-a74a-bd5f831473ee`
- `member_id` = `b9619bc5-6477-4ab8-b0fd-becee2787178`
- `category` = `pilates_cycling`, `pass_type` = `10-pack`
- `classes_total` = 10, `classes_remaining` = 10
- `price_paid` = `150.00`, `is_member_price` = `true`
- `status` = `active`
- `expires_at` = `now() + 60 days`
- `promo_code` = `mothers_day_2026`
- `stripe_payment_intent_id` = `pi_3TUd3gLyZrsSqLhs1ONhpbuV` (idempotency key, unique)
- `gift_buyer_email` = `fanaji72@gmail.com`, `gift_buyer_name` = `Fatima Naji`
- `gift_verification_status` = `auto`

The unique constraint on `stripe_payment_intent_id` makes the insert safe — it will fail if the row gets created concurrently, preventing double-fulfillment.

**Step 3 — Verify.**
Re-query `class_passes` for this PI and confirm it's linked to Fatima's `user_id`. She should now see the pack in her portal.

## Out of scope

Not changing the webhook code right now — this is a one-off cleanup. If we see more orphaned packs, we should investigate `mothers-day-pack-confirm` invocation reliability separately.
