# Batch 3 — Upcoming Renewal Reminders

Pre-charge heads-up emails so members know what's coming off their card before it happens. Pure addition — no changes to existing dunning, billing, or RPC logic.

## 1. Email templates (4 new)

Added to `supabase/functions/send-email/index.ts`. Same Storm branding (`#312D28` / `#E8DED1`), luxury formal tone, signed "— The Storm Wellness Club Team". Contact line: `admin@stormwellnessclub.com` or Member Services in portal.

- **`renewal_monthly_dues_3day`** — Subject: *"Your upcoming Storm monthly dues"*. Body: friendly reminder that `{amount}` will be charged on `{charge_date}` to `{card_brand} ending {last4}`. CTA: **Update Payment Method**.
- **`renewal_annual_dues_14day`** — Subject: *"Your Storm annual dues renew in 14 days"*. Body: 14-day notice for founding/annual members. Same card/amount/date merge fields. CTA: **Update Payment Method**.
- **`renewal_annual_fee_14day`** — Subject: *"Your Storm annual fee renews in 14 days"*. Body: explains the annual facility fee (separate from dues) is renewing. CTA: **Update Payment Method**.
- **`renewal_annual_fee_3day`** — Subject: *"Reminder: Storm annual fee charges in 3 days"*. Body: final heads-up before the annual fee posts. CTA: **Update Payment Method**.

No reminders for monthly dues at 14-day mark (too noisy month-over-month).

## 2. Tracking table

```text
payment_renewal_reminders
  id, member_id, reminder_type (enum), charge_date, sent_at, idempotency_key (unique)
```

`idempotency_key` format: `renewal-{member_id}-{reminder_type}-{charge_date}` — guarantees one send per charge per type, even if the scheduler runs many times.

RLS: service-role only (admin can read, no member access needed).

## 3. `process-renewal-reminders` edge function (new)

Runs daily at 9 AM Central via `pg_cron`. Logic:

1. For each member with `subscription_status = 'active'` AND `payment_past_due = false` AND no active freeze:
   - **Monthly dues members**: if `next_billing_date = today + 3`, send `renewal_monthly_dues_3day`.
   - **Annual dues members** (founding or annual cadence): if `next_billing_date = today + 14`, send `renewal_annual_dues_14day`.
   - **All members with `next_annual_fee_date`**: if `= today + 14`, send `renewal_annual_fee_14day`; if `= today + 3`, send `renewal_annual_fee_3day`.
2. Skip if `idempotency_key` already exists in `payment_renewal_reminders`.
3. Insert row on successful send.

Skips frozen members (they don't get charged) and past-due members (they're already in dunning cadence — no need for double messaging).

## 4. Files touched

- `supabase/functions/send-email/index.ts` — 4 new templates
- `supabase/functions/process-renewal-reminders/index.ts` (new)
- Migration — `payment_renewal_reminders` table + RLS
- Insert (not migration) — daily `pg_cron` job at 9 AM Central

## Guarantees

- **No double-sends** — unique idempotency key per member/type/charge date.
- **No interference with dunning** — skips past-due members entirely.
- **No interference with freezes** — skips frozen members.
- **Pure additive** — no changes to webhooks, RPCs, or member portal.

## Out of scope (later batches)

- `PastDueBanner` + manual "Retry Payment" button (Batch 4)
- Admin `/billing-arrears` dunning columns (Batch 4)
- Backfill of existing past-due members into `payment_dunning_state` (Batch 5)
- Scanner gate for past-due members (separate gap)
- Kids Care credit guard (separate gap)
