## Goal
Now that Stripe is set to leave failed subscriptions as `past_due` (never auto-cancel), our side needs to (1) make sure a stray cancel can't wipe a member, (2) auto-record every failed/new unpaid invoice into `billing_arrears` so the red "$X owed" badge stays accurate without anyone hitting "Sync from Stripe," and (3) give admins a one-click way to retry the saved card.

## Changes

### 1. Harden the Stripe webhook against `customer.subscription.deleted`
File: `supabase/functions/stripe-webhook/index.ts`
- On `customer.subscription.deleted`: do **not** set `members.status = 'cancelled'`, do **not** null out `stripe_subscription_id`, do **not** revoke benefits.
- Instead: log to `application_status_history` (or a new `subscription_events` note) with reason `stripe_cancel_received_ignored`, keep the member active, and surface a banner in admin (reuse existing arrears banner — no new UI table needed).
- Rationale: with Smart Retries set to `past_due`, Stripe should never cancel on its own. If a cancel still fires (manual dashboard action, fraud block, etc.) we keep the contract intact and an admin reviews it.

### 2. Auto-write every unpaid invoice into `billing_arrears`
File: `supabase/functions/stripe-webhook/index.ts`
Wire these events to the same upsert path that `sync_member_arrears` already uses:
- `invoice.payment_failed` → upsert arrears row (status `unpaid`), bump `attempt_count`, store `failure_message` / `decline_code` / `next_payment_attempt`.
- `invoice.created` (when `billing_reason in ('subscription_cycle','subscription_create')` and the sub is already `past_due`/`unpaid`) → upsert arrears row so month 2, month 3, … appear automatically.
- `invoice.payment_succeeded` → mark matching arrears row `paid`, set `amount_paid_cents`.
- `invoice.voided` / `invoice.marked_uncollectible` → mark `resolved` with reason.
- `customer.subscription.updated` where status flips to `past_due` → ensure latest open invoice has an arrears row.

Net effect: the red "$X owed" badge on the member row and the `ArrearsCard` total climb on their own each billing cycle. No one has to click "Sync from Stripe."

### 3. "Charge saved card now" admin button
New action on the member admin page (next to the existing `ArrearsCard`):
- New edge function `charge-member-arrears` that:
  - Takes `memberId` + optional `invoiceId` (defaults to oldest open invoice on that customer).
  - Calls `stripe.invoices.pay(invoiceId, { payment_method: <default pm> })` against the saved card.
  - On success: webhook flow already marks arrears `paid`; function also returns the result for instant UI feedback.
  - On decline: returns HTTP 200 with `success: false` + decline reason (per project's Stripe edge-function convention).
- Button in `ArrearsCard.tsx`: "Charge saved card now" with confirm dialog, shows toast with result, invalidates `member-arrears` query.

### 4. Small admin surfacing
- `/admin/billing-arrears` page already aggregates `billing_arrears` — no schema change needed.
- Add a "Charge now" button on each row there too so you can work the list top-to-bottom.

## Out of scope
- No DB migration; `billing_arrears` schema already supports all of this.
- No change to dues/annual-fee subscription creation logic.
- No change to the freeze/unfreeze flow.
- Not touching the `reconcile-arrear` classifier — it keeps working as-is.

## Verification after build
1. Pick a member with a known unpaid invoice → confirm arrears row exists without anyone hitting "Sync from Stripe."
2. Simulate `invoice.payment_failed` via Stripe CLI → arrears row appears within seconds.
3. Click "Charge saved card now" on a test member with a good card → invoice paid, arrears row flips to `paid`, badge disappears.
4. Manually cancel a test subscription in Stripe dashboard → member stays `active`, banner appears, no benefits revoked.