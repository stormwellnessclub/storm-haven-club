## Goal
Give you a working list of people to remind about finishing their Mother's Day Class Pack checkout, and make sure abandoned checkouts get tracked correctly going forward.

## Why it's empty today
- The Abandoned Class Pass Checkouts admin page reads from a database table (`pending_class_pass_checkouts`).
- That table currently has **0 rows**, because the Mother's Day Class Pack edge function had a Stripe configuration bug (just fixed) that prevented most attempts from reaching the database insert.
- Meanwhile, real abandoned attempts DO exist — they live in Stripe as PaymentIntents with status `requires_payment_method`, tagged with metadata `type = mothers_day_class_pack`. Example: customer `cus_USHRig8c1Tdtnd` has 4 failed attempts.

## Plan

### 1. Backfill from Stripe (immediate fix)
Add a "Recover from Stripe" button at the top of `Admin → Abandoned Class Pass Checkouts`. When clicked it calls a new edge function `backfill-mothers-day-abandoned` that:
- Lists Stripe PaymentIntents created in the last 14 days where `metadata.type = "mothers_day_class_pack"` and `status = requires_payment_method`.
- For each, upserts a row into `pending_class_pass_checkouts` (keyed by `stripe_payment_intent_id`) with buyer name, email, amount, tier, and gift recipient info pulled from the PaymentIntent metadata.
- Skips any PaymentIntent that has a later succeeded sibling for the same customer (already recovered organically).

Result: the Pending tab immediately shows everyone who started a Mother's Day pack checkout and didn't finish.

### 2. Send the reminder
The page already has a "Send reminder" button per row that calls `send-class-pass-abandoned-reminder` with steps 1/2/3 (1h, 24h, 72h cadence). After backfill you can:
- Click Send reminder on each row, or
- Run the existing `process-abandoned-class-pass-checkouts` cron to auto-send the next-due reminder for the whole batch.

Note: the cron job is currently returning 404 — fix that as part of this work so reminders auto-send going forward.

### 3. Harden tracking going forward
- Replace the silent `try { insert } catch (_) {}` in `mothers-day-pack-create-intent` with a logged failure so future insert errors are visible in edge logs instead of being swallowed.
- Add the same `pending_class_pass_checkouts` insert (with `stripe_payment_intent_id` upsert) to the Stripe webhook handler on `payment_intent.created` for Mother's Day pack intents, as a safety net even if the edge-function insert fails.
- Mark rows `status = completed` automatically on `payment_intent.succeeded` (the webhook already does this for regular class passes — extend the same matcher to `mothers_day_pack`).

### 4. Verify
- Run backfill, confirm the page shows the failed attempts including `cus_USHRig8c1Tdtnd`.
- Send a test reminder to one row and confirm delivery via `email_send_log`.
- Confirm new abandoned attempts created after deployment land in the table within seconds, without needing backfill.

## Out of scope
- No changes to pricing, fees, or the checkout UI itself (those were already fixed in the last round).
- Not auto-charging the saved card — reminders only; the buyer must complete checkout themselves.
