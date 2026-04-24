

## Goal
Make Kids Care subscription renewals reliably grant the next month's pass — so when the parent's card is charged, their child's 16 sessions are restored automatically. Also fix Summer Haidous's missed April 20 renewal.

## Root cause (confirmed)
Summer's April 20 charge of $77.55 ($75 Kids Care + $2.55 fee) on subscription `sub_1TDA1TLyZrsSqLhstugJs3t2` succeeded in Stripe. The webhook in `supabase/functions/stripe-webhook/index.ts` correctly detects the Kids Care line item, but the renewal handler depends on `subscription.metadata.user_id` / `member_id`. Her subscription has **no metadata** (likely created before metadata was added, or via a different path). The handler's `if (subUserId)` check silently fails, so no pass is created and no error is raised.

Her last pass (`8b7e8014`) expired April 19 with 7 of 16 remaining and was never replaced — that's why she can't book Kids Care.

## Plan

### 1. Make the webhook resilient when subscription metadata is missing
File: `supabase/functions/stripe-webhook/index.ts` (around lines 1886–1952)

Change the Kids Care renewal block so it can still resolve the user even when `subscription.metadata.user_id` is missing:
- If `subscription.metadata.user_id` exists → use it (current behavior).
- Otherwise, fall back to looking up the customer by `subscription.customer` (Stripe customer id) against `members.stripe_customer_id`, then fall back to `non_member_profiles.stripe_customer_id`.
- If found, derive `subUserId` (and `subMemberId` when from `members`).
- If still no match, `logError` with the subscription id, customer id, and invoice id (instead of silently skipping) so future failures show up.

Also: if the existing-pass lookup misses but we successfully resolve a user, also look for the most recent kids_care pass regardless of `status` (active/expired/exhausted) and reset it instead of always creating a new one when one is recent — prevents duplicate kids_care rows on accounts where the previous pass already flipped to `expired`.

### 2. Backfill metadata onto Summer's subscription so future renewals self-heal
Use Stripe to update `sub_1TDA1TLyZrsSqLhstugJs3t2` and add:
- `metadata.type = "kids_care_pass"`
- `metadata.user_id = f865462f-ba02-4d00-86ea-5475add08cd9`
- `metadata.member_id = 3c7f0bfc-d7ca-46bf-a62a-0903444e3012`

This is a one-time fix so that even before the code change ships, her next May 19 renewal would have processed correctly.

### 3. One-time backfill for the missed April 20 renewal
Insert a fresh kids_care pass for Summer matching what the renewal should have produced:
- `user_id = f865462f-ba02-4d00-86ea-5475add08cd9`
- `member_id = 3c7f0bfc-d7ca-46bf-a62a-0903444e3012`
- `category = 'other'`, `pass_type = 'kids_care'`
- `classes_total = 16`, `classes_remaining = 16`
- `price_paid = 75`, `is_member_price = true`
- `expires_at` = May 19, 2026 23:59:59 (matches Stripe `current_period_end` 1779310315)
- `status = 'active'`

Mark her old pass `8b7e8014` as `status = 'expired'` (it already passed its `expires_at`) so the UI shows only one active Kids Care pass.

### 4. Audit and backfill any other Kids Care subscriptions missing metadata
Iterate over the active Kids Care subscriptions (price `price_1TCEyxLyZrsSqLhsHLRDNixO`):
- For each, check if `metadata.user_id` is present.
- If not, look up the customer via `members.stripe_customer_id` (then `non_member_profiles.stripe_customer_id`), backfill the same three metadata fields on Stripe, and verify they have a current active `class_passes` row matching the subscription's current period; if not, insert one (same shape as step 3) using the subscription's `current_period_end` for `expires_at`.

This is a read-and-fix sweep so we don't rediscover the same problem next month for other parents. Uses the existing `stripe-payment` connection — no new infrastructure.

### 5. Light operational logging
In the renewal block, change the silent skip at the missing-metadata path into:
- `logError(new Error("Kids Care renewal: subscription missing user_id metadata"), "KIDS_CARE_RENEWAL_NO_USER")` with `{ subscriptionId, customerId, invoiceId }`.

So if anything new ever lands in this state, it shows up in logs immediately instead of going silent.

## Files to update
- `supabase/functions/stripe-webhook/index.ts` — resilient user resolution + better logging in the Kids Care renewal handler

## Database / data fixes (one-time)
- Insert one new `class_passes` row for Summer (April 20 → May 19 cycle)
- Update old pass `8b7e8014` → `status = 'expired'`
- Run the audit + backfill sweep for other Kids Care subscriptions

## Stripe-side fixes (one-time)
- Add `type` / `user_id` / `member_id` metadata to Summer's Kids Care subscription
- Add the same metadata to any other Kids Care subscriptions found missing it

## Out of scope
- No schema changes
- No change to how new Kids Care subscriptions are created (they already include metadata)
- No change to non-Kids-Care renewal paths

## Expected result
- Summer Haidous immediately has a fresh 16-session Kids Care pass valid through May 19, 2026 and can book her child.
- Future Kids Care renewals work for her and any other previously-affected parent without manual intervention.
- If a Kids Care subscription ever lacks metadata again, the webhook resolves the user via Stripe customer id and still grants the pass — and if it can't, it logs a clear error instead of silently dropping the renewal.

