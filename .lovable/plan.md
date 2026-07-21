## Goals

1. **Purchase history detail** – members can see item descriptions and the date of sale (not just a truncated line) in the portal.
2. **Failed cafe/POS charges** – when a "charge card on file" attempt fails, it is recorded, emailed to the member, and shows in both the member portal and admin views.
3. **Admin failed-payment "Resolve" button** works on old/already-succeeded/superseded rows, not only on rows that are currently `failed`/`requires_action`.

## Changes

### 1. Portal Payment History (`src/pages/portal/PaymentHistory.tsx`)
- Expand each row into an expandable detail (click chevron) showing:
  - Full description (currently truncated to the DB `description` field).
  - Itemized breakdown from `manual_charges.metadata.items` and `cafe_orders.items` when present.
  - Optional staff note (`manual_charges.note` / `cafe_orders.note`).
  - Sale date + time (America/Detroit, formatted "MMM d, yyyy · h:mm a").
  - Payment method summary (brand · last4) when available in metadata.
- Add `cafe_orders` to the union so cafe purchases appear alongside `manual_charges` and `class_passes`.
- Include rows with `status IN ('failed','requires_payment_method','requires_action')` and show a red "Failed" badge with the decline reason (from `metadata.decline_reason` or `metadata.error`).

### 2. Record failed cafe / POS card-on-file charges
In `supabase/functions/stripe-payment/index.ts`:
- In the `chargeSavedCard` / POS branches (around lines 1739 and 7580) and inside the outer `catch` (line 7617), when a `StripeCardError` occurs during `paymentIntents.create({confirm:true, off_session:true})`, insert a `manual_charges` row (or a `cafe_orders` row for cafe POS) with:
  - `status: 'failed'`
  - `stripe_payment_intent_id`: `error.payment_intent?.id` when Stripe returned one, otherwise null.
  - `metadata`: `{ decline_code, decline_reason: error.message, failed_at }`.
  - `note`, `amount`, `description`, `member_id`, `user_id`, `charged_by` preserved from the request.
- After recording, invoke `send-email` with a new template `cafe_charge_failed` (or `pos_charge_failed` for non-cafe POS): itemized breakdown, decline reason, "please update your card / bring payment on next visit" copy, and the staff note.
- Return the existing `{ success: false, error }` shape so the frontend keeps its current UX.

### 3. Admin visibility of failed cafe charges
- `src/pages/admin/FailedPaymentsHistory.tsx` – extend the `billingType` filter to include `pos` and `cafe`, and update `useFailedPaymentsHistory` to union `manual_charges` rows where `type IN ('pos','cafe')` and `status='failed'` (currently the hook only surfaces subscription/`payment_attempts` failures — confirm and extend as needed).
- Add a Cafe/POS failure count to the summary KPIs.

### 4. Resolve button always available (`FailedPaymentsHistory.tsx`)
- Change the render condition at line 466/518 so the **Resolve** button also shows for rows that are already `succeeded`, `superseded`, or have a `recovered` flag but no `resolved_at`. Only hide it when `resolved_at` is already set.
- When resolved status ≠ `failed`, pre-select `superseded_by_later_payment` as the default reason.
- Keep the audit-trail insert into `payment_attempts.metadata.resolution` unchanged.

### 5. Failed-charge email template
- New template `pos_charge_failed` in `send-email` edge function (mobile-safe table layout, matches existing `pos_charge_receipt` styling): decline reason, itemized cart, staff note, "Please stop by the front desk or update your card" call-to-action linking to `/member/payment-methods`.

## Notes / Non-goals
- No schema migration needed for `manual_charges` (already has `status`, `metadata`, `note`). If `cafe_orders` lacks a `status='failed'` value, a small migration will add it.
- Timezone stays `America/Detroit`.
- Portal design tokens reused; no new colors.