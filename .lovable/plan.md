# Batch 2 — Dunning scheduler + benefit gates

Picks up where Batch 1 left off. Data layer, webhook, Day 0 email, and recovery email already ship. This batch finishes the email cadence and turns the `payment_past_due` flag into actual behavior.

## 1. Four remaining email templates

Add to `send-email/index.ts` (same pattern as `dunning_day_0`), using locked copy from `.lovable/plan.md`:

- `dunning_day_1` — "Your Storm account remains past due" + Resolve Balance CTA
- `dunning_day_3` — "Past due — action required to preserve your Storm membership" (reapplication-risk language + Update Payment Method CTA)
- `dunning_day_5` — "Action required: Storm membership in arrears" + Update Payment Method CTA
- `dunning_day_7` — "Immediate Action Required" (revised body, NOT a final notice) + Resolve Balance CTA

All include the standard contact line and Storm branding (`#312D28` / `#E8DED1`). No "last automated notice" wording anywhere.

## 2. `process-payment-dunning` edge function (new)

Hourly scheduler. For every row in `payment_dunning_state` with `status = 'active'`:

1. Compute `days_since = floor((now - failed_at) / 1 day)`.
2. Determine the next due touchpoint from `{0, 1, 3, 5, 7}` that is `<= days_since` and not present in `emails_sent`.
3. Send the matching template via `send-email` with idempotency key `dunning-{invoice_id}-day-{n}`.
4. Append `{ day: n, sent_at: now }` to `emails_sent` jsonb.
5. After Day 7 is sent, leave `status = 'active'` (future cadence will extend it) — do NOT mark abandoned.

Skip rows where the member's `payment_past_due` flag has been cleared (webhook will already have sent recovery).

Schedule via `pg_cron` hourly using `net.http_post` (insert with `supabase--insert`, not migration, since URL/anon key are project-specific).

## 3. Booking + credit RPC guards

Add `payment_past_due` checks to the credit/member-priced paths only. Paid-out-of-pocket paths stay open.

- `book_class_session` / class-pass deduction RPC — if `is_member_past_due(member_id)` AND the booking uses included monthly credits OR member pricing, raise `EXCEPTION 'PAYMENT_PAST_DUE: Account past due — please update your payment method, or proceed at the drop-in rate.'`. Drop-in / class-pass purchases bypass.
- Wellness booking RPC (Red Light / Cryo / ZeroBody) — block credit-backed sessions, allow paid sessions.
- Kids Care booking RPC — block credit-backed sessions; explicit single-session purchase remains allowed.
- Spa: no change (already paid at checkout).
- Cafe / retail: no change.

Frontend surfaces the raised message verbatim through existing booking error toasts — no UI changes required this batch.

## 4. Scanner / building entry

`process_member_scan` already enforces billing blocks. Add a parallel branch: if `payment_past_due = true` AND no active drop-in/pass for today, return `denied` with reason `payment_past_due`. If they have a paid pass for today, allow entry. (Login is still untouched.)

## Files touched

- `supabase/functions/send-email/index.ts` — 4 new templates
- `supabase/functions/process-payment-dunning/index.ts` (new)
- Migration: update booking/credit/scanner RPCs with `payment_past_due` guard
- Insert (not migration): hourly `pg_cron` job for `process-payment-dunning`

## Guarantees

- No change to `members.status`, login, `member_freezes`, or pay-as-you-go transactions.
- All sends idempotent via `emails_sent` jsonb + `idempotencyKey`.
- Day 7 is the last *scheduled* touch this build — schema supports adding Day 10/14/30 later without migration.
- Recovery email (Batch 1) still fires the moment Stripe reports `payment_succeeded`.

## Out of scope (later batches)

- Upcoming renewal reminders (Batch 3)
- Auto-retry on card update + manual "Retry Payment" button (Batch 4)
- `PastDueBanner` + admin `/billing-arrears` dunning columns (Batch 4)
- Backfill (Batch 5)
