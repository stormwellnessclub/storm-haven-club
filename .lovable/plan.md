
## What's actually happening with Ayana's account

Her **identity is correctly linked** — `auth.users`, `profiles`, `members`, `non_member_profiles`, and `mothers_day_vouchers` all share `user_id = 112b680c-…d9cc` and email `ayanaadam@yahoo.com`. There is no broken account link.

What keeps breaking is **purchase → pass fulfillment**. Stripe charges her successfully, but the `class_passes` row never lands automatically. Evidence from her own history:

| Stripe payment (succeeded) | Date | What it bought | `class_passes` row | `stripe_payment_intent_id` on the pass |
|---|---|---|---|---|
| `pi_3TK1DSLyZrsSqLhs13yRlD31` ($175.39) | Apr 4 | 10-pack Pilates/Cycling | created **Apr 27** (23-day gap) | **NULL** — manual insert |
| `pi_3TK125LyZrsSqLhs0fsoRpHs` ($154.79) | Apr 4 | 2× Kids Care monthly | created **Apr 8** (4-day gap) | **NULL** — manual insert |
| `pi_3TVjffLyZrsSqLhs1Yl0HDwb` ($154.79) | May 16 | Mother's Day 10-pack | created **today only after we ran `mothers-day-pack-confirm` by hand** | populated only because the confirm function writes it |

Every time, the pattern is the same: Stripe collected the money, but the post-purchase code that grants the pass didn't run. An admin later created the row by hand, which is why the PI id is missing on the old rows.

## Why it happens (three independent failure paths, none of which has a safety net)

1. **Class-pass Checkout (Stripe Checkout Session)** — `stripe-payment` opens a Checkout Session. The pass row is inserted only by `stripe-webhook` on `checkout.session.completed`. `class-pass-confirm` (the URL the browser returns to) does **not** create the pass — it only emails. So if the webhook doesn't deliver or doesn't process that event for any reason, the pass never exists. The insert at `stripe-webhook` line 691 also doesn't write `stripe_payment_intent_id`, so we can't tell after the fact which PI a pass came from.

2. **Mother's Day pack (raw PaymentIntent)** — `mothers-day-pack-create-intent` creates a bare PaymentIntent. The pass is inserted only when the browser calls `mothers-day-pack-confirm` after redirect. If the buyer closes the tab, loses connection, or the page errors, the pass never lands. The `stripe-webhook` `payment_intent.succeeded` branch is the only fallback, and it depends on the webhook being subscribed to that event and on the PI metadata being complete.

3. **Kids Care monthly (subscription)** — `kids_care_pass` is handled in `stripe-webhook` `checkout.session.completed`. Same single point of failure as #1, plus no PI/invoice id is recorded on the pass row.

There is **no scheduled reconciler** that compares Stripe's "succeeded" payments against `class_passes` and fills gaps. `mothers-day-reconcile` only handles spa vouchers. `process-abandoned-class-pass-checkouts` only sends reminder emails.

## The plan

### 1. Make every pass row carry its Stripe id (so we can detect gaps)
- Update the three insert sites to always write `stripe_payment_intent_id` (or `stripe_invoice_id` / `stripe_session_id` for subs):
  - `stripe-webhook` class_pass insert (line ~691)
  - `stripe-webhook` kids_care_pass insert (line ~796)
  - `mothers-day-pack-confirm` (already writes it)
- Add a partial unique index on `class_passes(stripe_payment_intent_id)` where not null, so the reconciler is safe to re-run.

### 2. Add a single reconciler: `class-pass-reconcile` (runs every 5 min via `pg_cron`)
For each succeeded Stripe PaymentIntent in the last 30 days whose metadata `type` is `class_pass`, `kids_care_pass`, or `mothers_day_pack` and which has no matching `class_passes.stripe_payment_intent_id`:
- Replay the appropriate fulfillment path (call `mothers-day-pack-confirm` by PI id, or directly insert the class-pass row using the same logic as `stripe-webhook`).
- Mark any matching `pending_class_pass_checkouts` row `completed`.
- Log every reconciliation to a new `payment_reconciliations` table (PI id, action, result) so we can audit "ghost charges" going forward.

### 3. One-time backfill
Run the reconciler over the last 60 days. This will:
- Stamp `stripe_payment_intent_id` on Ayana's two existing orphan rows (`pi_3TK1DSLyZrsSqLhs13yRlD31`, `pi_3TK125LyZrsSqLhs0fsoRpHs`) so they're auditable.
- Auto-grant any other customer in the same situation we haven't noticed yet.

### 4. Tighten the post-redirect path
- `class-pass-confirm` currently waits up to 4 s for the webhook then returns "no pass yet" — extend it to call the new reconciler synchronously for that PI as a fallback, so the buyer's own browser triggers fulfillment in addition to the webhook + cron.
- Same change in `mothers-day-pack-confirm` (already does this).

### 5. Admin visibility
Add a small admin page **Billing → Unfulfilled payments** that lists, in real time, succeeded Stripe payments in the last 30 days with no matching pass/credit row. One-click "Fulfill" button calls the reconciler for that PI. This is the human-readable version of #2 and is what would have caught all three of Ayana's incidents immediately.

### 6. Clean up Ayana's duplicate profile (small, separate)
She has both an active `members` row and a `non_member_profiles` row (`a7590c1e-…`). Delete the non-member row and add a trigger so we don't auto-create a `non_member_profiles` row for a `user_id` that already owns an `active` `members` row.

## Technical notes
- `mothers-day-pack-confirm` is already idempotent on `stripe_payment_intent_id`; the reconciler relies on that.
- All needed metadata is already on the PaymentIntent / Checkout Session — no schema change needed on Stripe's side.
- New DB objects: `payment_reconciliations` table, partial unique index on `class_passes.stripe_payment_intent_id`, one `pg_cron` job, one trigger preventing duplicate non-member profile rows.
- New edge function: `class-pass-reconcile`. Modified: `stripe-webhook`, `class-pass-confirm`. No frontend changes for the fix itself; the admin page (#5) is the only UI work.
- Webhook subscription: confirm in Stripe that `payment_intent.succeeded` and `checkout.session.completed` are both enabled. If not, enable them (no code change needed).

## Out of scope
- Touching Ayana's existing pass balances — they're already correct, we just stamp PI ids on them during backfill.
- Reworking subscription/dues fulfillment (separate flow, not implicated here).
