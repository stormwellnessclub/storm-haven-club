## Confirming the bad news first

Yes — to be blunt: **no member has ever received a Day 0, 1, 3, 5, or 7 failed-payment email.** `email_audit_log` has zero rows for any `dunning_*` template, and `payment_dunning_state` has zero rows ever. The system was wired but two column-name typos in the cron worker made it silently no-op, and the webhook seeding never produced rows for the 4 currently past-due members (they were flagged via admin/arrears paths, not the Stripe webhook).

The good news: `application_card_declined` and `card_expiring` emails *are* sending fine, so the send infrastructure works — only the dunning branch is broken.

## Plan

### 1. Fix the column-name bugs in `process-payment-dunning`
- Line ~51: `row.failed_at` → `row.first_failed_at` (current bug produces `NaN` days → no email ever qualifies)
- Line ~73: `row.amount_due_cents` → `row.amount_cents` (would render "$undefined" in body)

### 2. Backfill `payment_dunning_state` for currently past-due members
- New one-shot edge function `backfill-dunning-state` (admin-invocable)
- For each member with `payment_past_due = true` and no open `payment_dunning_state` row: look up their latest open/past_due Stripe invoice, insert a seed row with `first_failed_at = invoice.created`, `attempt_count`, `amount_cents`, `stripe_invoice_id`
- After backfill the hourly cron picks them up and the Day 1/3/5/7 sequence kicks in based on actual age

### 3. Wire `admin_payment_failed_alert` so you get notified
- Fire from `stripe-webhook` on `invoice.payment_failed` (right after the member Day 0 send)
- Fire from `charge-member-arrears` when a manual retry fails
- Recipient: `storm@stormwellnessclub.com` (confirm if you want a different inbox)
- Payload: member name, email, amount, attempt #, Stripe invoice link

### 4. Add Day 0 send to `charge-member-arrears` failure path
- When the admin one-click retry fails, also seed/update `payment_dunning_state` and trigger the Day 0 dunning email — currently this path bypasses the webhook entirely so no email goes out at all

### Verification after build
- Re-deploy `process-payment-dunning`, `stripe-webhook`, `charge-member-arrears`, `backfill-dunning-state`
- Run the backfill once → check `payment_dunning_state` has 4 rows
- Manually invoke `process-payment-dunning` → check `email_audit_log` for `dunning_*` rows for the 4 affected members
- Confirm one admin alert lands in your inbox

### One question before I build
For the 4 currently past-due members: do you want me to **send them the catch-up dunning emails now** (Day 0 immediately, then Day 1/3/5/7 staggered based on how long they've been past due), or **silently seed the state** so only *future* failures get the sequence? Catching them up is the right move for revenue recovery but it will land 1-4 emails in their inbox today.