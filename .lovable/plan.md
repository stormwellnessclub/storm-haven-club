# Backfill Plan — Last 6 Months, No Emails

## Goal
Pull every Stripe charge + invoice from the last 6 months into `payment_attempts` and `billing_arrears` so existing past-due members surface in `/admin/billing-arrears`. **No dunning emails or SMS are sent.**

## Why this is safe
The `backfill-payment-history` edge function only writes to two tables:
- `payment_attempts` (via `log_payment_attempt` RPC) — pure history log, no side effects
- `billing_arrears` (upsert by `member_id, stripe_invoice_id`) — also just a ledger row

Neither write triggers an email or SMS. The dunning email/SMS system fires from the Stripe webhook (`invoice.payment_failed` live events) and from explicit admin actions in the Bulk dialogs — not from backfill inserts. So this run is silent by design.

## Steps

1. **Invoke the edge function** with a 6-month window:
   - `start` = 2025-12-07 (today − 6 months)
   - `end` = now
   - `dryRun: false` (we want the data written so you can review it in the admin UI)

2. **Report back** the result counts:
   - charges processed / inserted / skipped (no matching member)
   - invoices processed / arrears rows upserted
   - any errors

3. **You review** the resulting list at `/admin/billing-arrears` — filter to unpaid/past_due, eyeball who's there, flag anyone missing or wrong.

4. **Hold for your confirmation** before any bulk SMS / bulk charge / dunning is triggered against this list. Nothing in the backfill itself contacts members.

## After you confirm the list
Then (separate turn) we can:
- Seed `payment_dunning_state` rows for the unpaid ones so the timeline + retry buttons light up, OR
- Use the Bulk Charge / Bulk SMS dialogs you already have on `/admin/billing-arrears` to actually reach out.

## Open question
Do you want me to also seed `payment_dunning_state` rows during the backfill (so the dunning timeline shows them and "Retry charge" works one-click), or keep this run strictly to history + arrears and add dunning state only after you bless the list? Default plan above is the latter — strictly silent ledger import.
