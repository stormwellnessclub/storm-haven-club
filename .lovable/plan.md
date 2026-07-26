## 1. Delete PT packs from pricing

In `src/pages/admin/PersonalTrainingPacks.tsx`, add a **Delete** button next to Edit on each pack row.

- Safe-delete RPC `delete_pt_pack(pack_id uuid)`:
  - If any `pt_passes` reference this pack → **soft delete**: set `is_active=false`, `is_public=false`, and rename to `"[Archived] " + name` (preserves history for existing passes).
  - If no passes reference it → **hard delete** the row.
- Confirmation dialog explains which path will happen ("This pack has 3 sold passes and will be archived" vs "This pack will be permanently deleted").
- Invalidates the same query keys `save()` already uses.

## 2. Admin-only payment plans (autopay installments)

Scope: **admin sale flow only** — no changes to public PT pricing pages or customer-facing checkout.

### Data model (migration)

Extend `pt_packs` with admin-only installment config:
- `allow_payment_plan boolean default false`
- `payment_plan_months integer` (e.g. 2, 3, 4, 6) — nullable
- `payment_plan_stripe_price_id text` — nullable, auto-created when enabled

Extend `pt_passes` to track plan state:
- `payment_plan_subscription_id text` (Stripe sub id)
- `payment_plan_total_installments integer`
- `payment_plan_installments_paid integer default 0`
- `payment_plan_status text` — `none | active | completed | past_due | cancelled`

### Admin Packs UI

In the pack editor dialog, add a **"Payment plan (admin-only)"** section:
- Toggle: Allow payment plan
- When on: number input for # of monthly installments
- Helper text: "Only visible in Sell PT dialog. Splits price into equal monthly charges via Stripe subscription."
- On save, if enabled, edge function creates/updates a Stripe recurring Price (`unit_amount = ceil(price_cents / months)`, `interval=month`) and stores the id.

### Sell PT dialog

In `src/components/admin/SellPTDialog.tsx`, for any selected pack with `allow_payment_plan=true`, show a payment option toggle:
- **Pay in full** (existing behavior)
- **Payment plan – N monthly charges of $X** (new)

When payment plan is chosen and admin is charging card on file:
- New edge function `admin-create-pt-payment-plan` creates a Stripe subscription on the member's customer using the plan price, with `cancel_at` set after N cycles (or `iterations` via a schedule) so it auto-ends.
- Grants the `pt_pass` immediately with full sessions, and sets `payment_plan_*` fields.
- Failed installments follow the existing dues past-due pattern: mark `payment_plan_status='past_due'`, add to `billing_arrears`, notify per existing dunning.

Send-link and cash/Clover/external methods stay pay-in-full only (no installments outside card-on-file).

### Webhook

Extend the existing Stripe webhook to recognize this subscription category by metadata (`type: 'pt_payment_plan'`, `pt_pass_id`):
- On each `invoice.payment_succeeded`: increment `payment_plan_installments_paid`; when it hits the total, mark `completed`.
- On `invoice.payment_failed`: mark `past_due` + create `billing_arrears` row.
- On `customer.subscription.deleted` after completion: no-op; on early cancel: mark `cancelled`.

### Member portal display

In `MyPTPassesSection.tsx`, if a pass has an active payment plan, show a small line: `"Payment plan: 2 of 4 monthly charges paid"`. Read-only.

## Files touched

- `src/pages/admin/PersonalTrainingPacks.tsx` — delete button + payment plan fields in editor
- `src/components/admin/SellPTDialog.tsx` — pay-in-full vs payment-plan toggle
- `src/components/portal/MyPTPassesSection.tsx` — installment progress line
- New migration — schema fields + `delete_pt_pack` RPC
- New edge function `admin-create-pt-payment-plan`
- New edge function `sync-pt-pack-plan-price` (creates Stripe recurring price when plan is enabled/changed)
- `supabase/functions/stripe-webhook/index.ts` (or equivalent) — handle `pt_payment_plan` metadata
