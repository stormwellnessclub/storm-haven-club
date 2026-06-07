# Arrears cleanup + charge-type classification

## Part 1 — Data cleanup (one-time)

Resolve the false/stale arrears rows surfaced by the 6-month backfill:

- **Sarah Siddiqui** — archive member record (set `status='archived'`) and resolve all her `billing_arrears` rows as `not_a_member`.
- **Maryam Hachem** — resolve all arrears as `kids_care_cancelled`.
- **Jessica Seagull** — resolve all arrears as `kids_care_paid`.
- **Zahna Abdallah** — resolve all arrears as `paid_externally`.
- **Rama Alhoussaini** — resolve all arrears as `paid_externally` (current as of today).
- **Jeree Spicer** — resolve April invoice as `paid_late` (Stripe shows succeeded); keep May open.
- **Mariam Alsheeblawy** — leave April + May open (15th cycle).
- **Sherene Albosaraj** — leave March + April + May open (9th cycle).
- **Ayah Boussi** — leave April + May open (10th cycle).

Each resolution sets `status='resolved'`, `resolution_reason=<reason>`, `resolved_at=now()`, scoped per member's `member_id`.

## Part 2 — Make the system differentiate charge types

The core bug: backfill labels every invoice `membership_dues` (or whatever Stripe's `billing_reason` says, which collapses unrelated subs together). Kids care, class passes, and shop charges are bleeding into the dues arrears view.

### 2a. Backfill classifier (`supabase/functions/backfill-payment-history/index.ts`)
Before upserting `billing_arrears`, fetch invoice line items and classify against `PRICE_ID_MAP` + product-name keywords:

- `membership_dues` — monthly/annual dues price IDs
- `annual_fee` — annual facility fee price IDs
- `kids_care` — kids-care subscription price IDs (month-to-month, separate)
- `class_pass` — pilates/cycling pass price IDs
- `guest_pass` — guest pass price IDs
- `shop` — storm shop products
- `other` — fallback

Stored on `billing_arrears.billing_type` so downstream queries can filter cleanly.

### 2b. One-time reclassification
After deploy, re-run a scoped invoice pass (or a small SQL update keyed off cached `stripe_invoice_id`) to backfill `billing_type` on the 440 existing rows.

### 2c. Arrears page (`/admin/billing-arrears`)
- `useBillingArrears` already filters `DUES_TYPES` — confirmed correct. Kids care will drop out automatically once reclassified.
- Add a small "Type" segmented control above the table: **Dues** (default) · **Kids Care** · **Other** · **All**, so non-dues debt is still visible without polluting the dues view.
- Each row's outstanding badge stays scoped to the selected type.

### 2d. Member detail (`/admin/members/:id`)
The arrears card on member detail should also group by `billing_type` so "owes May dues" doesn't get conflated with "owes kids care".

## Part 3 — Verification

After Parts 1 & 2:
1. Re-pull `/admin/billing-arrears` (Dues filter). Expected list: Jeree (May), Mariam (Apr+May), Sherene (Mar+Apr+May), Ayah (Apr+May). Total ~$1,400.
2. Switch to "Kids Care" filter — should be empty (Maryam/Jessica resolved).
3. No emails or SMS sent. Outreach still requires explicit click in Bulk dialogs.

## Technical notes
- Resolutions use the data-update tool (UPDATE statements scoped by `member_id` + `billing_type` where applicable).
- Classifier is a pure-function lookup added to the edge function; no schema change needed (`billing_type` column already exists).
- Type filter on arrears page is a 1-line addition to `ArrearsFilters` + a `<ToggleGroup>` in `BillingArrears.tsx`.
- Kids care subs stay completely outside the dues dunning pipeline — `payment_dunning_state` is only seeded for `membership_dues` / `annual_fee` rows.
