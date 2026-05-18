## What happened

Ayana Adam (ayanaadam@yahoo.com, auth `112b680c-…d9cc`) paid **$154.79** for the Mother's Day Class Pack — Member (10 classes) on 2026-05-10 (Stripe PI `pi_3TVjffLyZrsSqLhs1Yl0HDwb`, status `succeeded`).

But the database has **no `class_passes` row** for that payment intent. The `mothers-day-pack-confirm` edge function never logged anything for this PI, so fulfillment silently failed after Stripe confirmed the charge (likely the browser closed before the confirm call, or the call errored client-side without retry).

The webhook safety net (`stripe-webhook` handling `payment_intent.succeeded` for `metadata.type='mothers_day_class_pack'`) also has no trace of running on this PI.

## Fix

Re-fulfill by invoking the existing idempotent confirm function for that PI. Because it's idempotent on `stripe_payment_intent_id`, it's safe to call manually:

```text
POST /functions/v1/mothers-day-pack-confirm
body: { "payment_intent_id": "pi_3TVjffLyZrsSqLhs1Yl0HDwb" }
```

Expected result:
- Inserts a `class_passes` row: `pass_type=10-pack`, `category=pilates_cycling`, `classes_remaining=10`, `is_member_price=true`, `expires_at = now + 60 days`, `user_id=112b680c-…d9cc` (auto-linked via her active member email), `promo_code=mothers_day_2026`.
- Fires the confirmation email via `send-mothers-day-pack-confirmation`.
- The pack will then appear on her member dashboard immediately.

## Optional follow-up (separate task, not required for this fix)

The same silent-failure mode can happen to other buyers. The existing `mothers-day-reconcile` cron is supposed to catch this — worth checking why it didn't pick up her PI (e.g. it may only scan recent PIs, or only ones with `metadata.type` set, or its scheduled run doesn't reach back to 5/10). If you want, I can audit it in a separate task.

## Steps

1. Invoke `mothers-day-pack-confirm` with `pi_3TVjffLyZrsSqLhs1Yl0HDwb`.
2. Verify a `class_passes` row now exists for her `user_id` with `pass_type='10-pack'` and `classes_remaining=10`.
3. Ask Ayana to refresh her dashboard.
