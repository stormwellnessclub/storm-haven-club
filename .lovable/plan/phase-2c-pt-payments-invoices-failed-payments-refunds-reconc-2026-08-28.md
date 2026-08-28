# Phase 2C — PT Payments, Invoices, Failed Payments, Refunds & Reconciliation

Built on the Phase 2A ledger guards and Phase 2B package/payment architecture. Nothing in 2A/2B is replaced.

## What already exists (verified now)

- `pt_payments` (money in: method, status, Stripe payment intent, idempotency key, recorded_by, notes) and `pt_payment_allocations` (payment to appointment and/or package). Both currently hold 0 rows — safe to extend.
- `pt_passes` already carries financial provenance: `amount_paid_cents`, `amount_outstanding_cents`, `financial_status`, `payment_plan_*`, `stripe_subscription_id`.
- Sanctioned RPCs: `pt_record_session_payment`, `pt_settle_with_package`, `pt_waive_sessions`, `pt_finalize_package_sale`, `pt_link_payment_plan`, `pt_apply_session_delta`, plus role helpers `pt_is_financial_staff` / `pt_is_financial_manager`.
- Club-wide payment infrastructure: `manual_charges`, `payment_attempts`, `payment_dunning_state` (member-scoped, Stripe-invoice keyed), `refund_requests`, `process-payment-dunning`, `stripe-payment` edge function with `process_admin_refund`.
- Admin member profile has a Payments tab (`PaymentsTabContent` + `ChargeHistory`, which reads `manual_charges`).
- PT billing workspace exists at `/admin/pt/billing` with Unpaid sessions, Autopay, Payment activity tabs.

Current PT production counts: 55 appointments, 6 passes, 0 payments, 0 allocations, 0 sale intents.

## Approach

Reuse, don't duplicate. `pt_payments` stays the single PT money record; invoices become a thin obligation layer on top; dunning extends the existing tables with PT service linkage rather than a second retry engine; the main admin Payments tab reads the same PT records rather than copying them.

## Build order

### 2C.1 Source map (no schema change)
Produce the internal map of every PT financial event to its authoritative source, and confirm which of the twelve event types the current tables can already represent. Only the gaps below get new schema.

### 2C.2 Schema additions (one migration, additive)
- `pt_invoices`: client, invoice number (sequence), issue/due date, status (draft, sent, viewed, partially_paid, paid, past_due, void), subtotal, discount, tax, total, amount_paid, amount_due, notes, internal notes, created_by, voided_by/at.
- `pt_invoice_line_items`: invoice, description, quantity, unit amount, related appointment, related pass.
- `pt_refunds`: original payment, amount, method (stripe/manual), Stripe refund id, reason, actor, related invoice/pass/appointment, created_at.
- `pt_payment_corrections`: target record, field, original value, corrected value, reason, actor, timestamp (append-only; no silent edits).
- `pt_payment_communications`: recipient, related payment/invoice, channel, template, queued/sent time, delivery status, failure.
- Extend `pt_payments` with `refunded_cents`, `status` values for refunded/partially_refunded, `invoice_id`.
- Extend `pt_payment_allocations` with `invoice_line_item_id`.
- Extend `payment_dunning_state` with `service_type` ('membership' | 'personal_training'), `pt_pass_id`, `pt_invoice_id`, so one dunning engine covers both and neither chases the same obligation.
- Every new table: GRANTs, RLS enabled, staff policies via `pt_is_financial_staff`, client self-read policies scoped to `user_id` with internal fields excluded through client-safe views.

### 2C.3 Server RPCs / edge functions
- `pt_create_invoice`, `pt_add_invoice_lines`, `pt_send_invoice`, `pt_void_invoice`, `pt_record_invoice_payment` (allocates across line items, settles each linked appointment through the existing settlement path, supports partial payment), all amount-capped and status-guarded.
- `pt_record_refund` — caps refund at net collected, writes `pt_refunds`, updates payment status; Stripe-originated refunds go through the `stripe-payment` edge function with idempotency; manual refunds are explicitly labelled manual.
- Entitlement adjustment stays a separate explicit call through `pt_apply_session_delta` — a refund never auto-removes sessions.
- `pt_charge_invoice_card` / manual retry: explicit staff action with confirmation, Stripe idempotency key derived from invoice + attempt, blocked when the obligation is already settled or voided.
- `pt_outstanding_balance(user_id)` — single documented hierarchy: an obligation is counted once, at the most specific level (invoice line > unpaid session > package outstanding > remaining plan installments), with invoiced amounts excluded from plan/session totals.
- `pt_client_financial_summary` and client-safe read views for the future member portal.

### 2C.4 UI
- `/admin/pt/billing`: new Payment History tab (client, date, amount, human-readable type, package, appointment, method, Stripe/manual, status, refund status, invoice link, receipt, staff actor, reference), Invoices tab, Failed & Past Due tab, and an expanded Upcoming view with Today / 7 / 30 / Later buckets.
- Package-credit settlements render as "Settled by package — $0 collected", visually distinct from collected money.
- Invoice builder supporting multiple unpaid sessions on one invoice, with per-line appointment linkage.
- Receipt view for successful payments and a Stripe hosted-receipt link where one exists; no raw payment-method IDs or internal notes shown.
- PT client detail: billing snapshot expands into a chronological financial timeline.
- Admin member profile Payments tab: PT payments, installments, invoices, refunds, failed payments and outstanding amount appear alongside membership activity, labelled `Service: Personal Training`, reading the same PT records with click-through to the package/appointment.

### 2C.5 Verification
Run tests A–T with disposable records in rolled-back transactions where possible, no real production cards, capturing pre/post counts, then report gates A–O.

## Technical notes

- All financial mutations are SECURITY DEFINER RPCs guarded by `pt_is_financial_staff` / `pt_is_financial_manager`; no client-side balance or payment writes.
- Stripe remains the source of truth for card money; local records reference, never contradict it.
- Dunning reuses `payment_dunning_state` and `process-payment-dunning` with a service discriminator, so retry scheduling, attempt counts and recovery logic are not forked.
- Invoices never mark themselves paid because a package exists; payment and entitlement stay separate.

Stops at the end of 2C. Phase 2D is not started.
