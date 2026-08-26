# Phase 1 — Personal Training System Map & Gap Audit (read-only)

Findings below come from inspecting the current codebase, database schema, functions, cron jobs, and live row counts. No changes were made.

## 1. Current source-of-truth map

| Object | Table (source of truth) | Key / relationships | Created in | Edited in | Displayed in |
|---|---|---|---|---|---|
| Client | `pt_client_profiles` (PT detail) over `profiles` / `members` / `non_member_profiles` | `user_id`; optional `member_id` | PT portal client screens | PT portal, PT mobile | PT portal, PT mobile |
| Trainer | `instructors` (+ `pt_trainer_availability`, `pt_trainer_locations`, `pt_trainer_formats`, `pt_client_trainers`) | `instructor_id` | Admin trainers page | Admin trainers page | PT portal, schedule |
| PT package (catalog) | `pt_packs` | `id`, `format`, `sessions`, `price_cents`, payment-plan fields | Admin PT Packs | Admin PT Packs | Sell dialog, PT portal |
| Sold package / balance | `pt_passes` | `id`, `user_id`, `pack_id`; `sessions_total` / `sessions_remaining` / `status` | `SellPTDialog`, `GrantLegacyPtPackDialog` (direct inserts) | `pt_adjust_pass_balance`, `pt_transfer_pass_sessions`, plus **direct table update** in legacy page | PT portal, legacy passes page, member + non-member portal, non-member admin detail |
| Package adjustment | `pt_pass_adjustments` | `pass_id`, delta, before/after, `transfer_pass_id`, `created_by` | Adjust/transfer RPCs only | — | PT Packages screen |
| Payment (one-time) | Stripe + `manual_charges`; `pt_passes.stripe_payment_intent_id`; `pt_appointments.payment_status/amount_due_cents/paid_at` | PaymentIntent id | `stripe-payment` (`admin_charge_user_saved_card`) | `admin_set_pt_session_payment` | PT unpaid page, PT reports |
| Invoice | None PT-specific. Membership invoices live in `payment_attempts` / Stripe | — | — | — | Billing screens (membership only) |
| Subscription / autopay | Stripe subscription created by `admin-create-pt-payment-plan`; mirrored on `pt_passes.payment_plan_*`; `stripe-webhook` updates installments via `pt_pass_ids` metadata | subscription id | Payment-plan function | Webhook | PT packages (limited) |
| Appointment | `pt_appointments` | `id`, `user_id`, `instructor_id`, `pass_id`, `usage_id`, `session_type_id`, `location_id`, `status`, `payment_status` | `book_pt_appointment` RPC | `pt_reschedule_appointment`, `cancel_pt_appointment`, `pt_complete_session`, `pt_set_package_deduction` | PT schedule, PT mobile, legacy schedule, member/non-member portal cards, admin non-member detail |
| Appointment request | `training_requests` (lead intake, 20 rows) — **not linked** to `pt_appointments` or clients | `id`, email/phone only | Public Training Request form | Admin Training Requests page | Admin Training Requests |
| Session usage | `pt_session_usage` (9 rows) | `pass_id` only, plus back-reference `pt_appointments.usage_id` | `pt_complete_session`, `pt_set_package_deduction`, `use_pt_session` | Deleted on free cancel | PT packages, PT reports |
| Communication / reminder | `pt_communications` (0 rows), `pt_alerts`, `pt_tasks`; transactional mail via `send-pt-booking-email` | `client_user_id`, `appointment_id` | PT portal messages, manual sends | PT portal | PT portal messages |

Portal coverage: PT admin portal (`/admin/pt/*`) uses all of the above. The **main admin member profile** (`/admin/members/:id`) has tabs Profile / Membership / Credits / Payments / Activity and shows **no PT data at all**. The trainer experience is the same `/admin/pt` portal (there is no separate trainer-only route). Member portal and non-member portal share `MyPTPassesSection` and `UpcomingPTAppointmentsCard`, reading `pt_passes` and `pt_appointments` directly.

## 2. Existing systems that should be reused (do not rebuild)

- `pt_passes` as the single balance record, mutated only through `pt_adjust_pass_balance` / `pt_transfer_pass_sessions` (both write full `pt_pass_adjustments` history).
- `book_pt_appointment` + `pt_check_appointment_conflict` (already handles double-booking, trainer/room conflicts, semi-private capacity).
- `pt_complete_session` / `pt_set_package_deduction` for deduction, and `cancel_pt_appointment` for cancel/credit outcome.
- Stripe: PT already uses the **same Stripe customer** as membership billing via `stripe-payment`, and records charges in `manual_charges`. Refund, failed-payment, dunning and receipt infrastructure already exists for membership (`payment_attempts`, `payment_dunning_state`, `process-payment-dunning`).
- Email: `send-email` + `email_audit_log` + `send-pt-booking-email` for confirmations/cancellations.

## 3. Duplicate or conflicting systems

1. **Two admin PT surfaces**: legacy `/admin/personal-training/{passes,packs,schedule,unpaid}` alongside the newer `/admin/pt/*` portal. Both operate on the same tables, but with different rules.
2. **Balance can be written two ways**: `PersonalTrainingPasses.tsx` updates `pt_passes.sessions_remaining` and `status` **directly**, bypassing `pt_adjust_pass_balance`, so those edits leave no adjustment history.
3. **Three deduction paths**: `pt_complete_session`, `pt_set_package_deduction`, and `use_pt_session` (deducts with no appointment link at all).
4. **Package sale writes are client-side inserts** (`SellPTDialog`, `GrantLegacyPtPackDialog` insert into `pt_passes` from the browser) rather than a transactional RPC — a partial failure after the Stripe charge leaves a paid client with no package (this class of failure has already occurred once).
5. **Leads vs appointments**: `training_requests` is a parallel intake list with no link to a client, package, or appointment.

## 4. Current operational gaps

- **Usage rows are not appointment-linked.** `pt_session_usage` stores only `pass_id`; the link is the reverse pointer `pt_appointments.usage_id`. Free cancellation **deletes** the usage row, so the audit trail is destroyed rather than reversed.
- **Staff cancellation is always credit-returning** (`v_free := is_staff OR >24h`), with no option to force a late/no-credit cancel. No-show does not consume a session anywhere.
- **No PT reminder automation.** Cron has class reminders and spa reminders (2h/24h) but nothing for PT appointments, PT package expiry, or PT low balance. `process-renewal-reminders` only reads `members` (membership dues); `pt_passes.renewal_reminder_sent_at` is only written by a manual staff action.
- **Main admin member profile shows no PT** — staff must switch portals to see a member's packages, balance, or upcoming sessions.
- **Member/non-member portals are read-only** for PT: they can view passes and cancel, but cannot request or book a session; the public `TrainingRequestForm` is the only entry point and it dead-ends in a separate list.
- **No PT invoice/receipt object.** One-time PT charges land in `manual_charges`; unpaid sessions live only as `pt_appointments.payment_status='unpaid'` (3 completed sessions currently unpaid). PT payments are not visible in the member's Payments tab.
- **Recurring/autopay PT exists only as package instalment plans** (currently 0 in use); there is no recurring "sessions per month" subscription.
- `pt_communications` is wired in the UI but has 0 rows — outbound PT email/SMS is not being logged there.

## 5. Interconnection rule check

The rule **ONE PT RECORD → MULTIPLE AUTHORIZED VIEWS** is currently **satisfied for data**: PT admin, PT mobile, member portal, non-member portal, and admin non-member detail all read the same `pt_passes` / `pt_appointments` rows. There are no copied balance fields. It is **not satisfied for coverage**: the main admin member profile renders none of these records, and the trainer role has no dedicated authorized view.

## 6. Where changes will be needed in Phase 2

**Database changes required**
- Add `appointment_id` and `user_id` to `pt_session_usage`, plus a reversal/void concept so cancellations stop deleting history.
- Add a cancellation-reason/credit-outcome parameter to `cancel_pt_appointment` so staff can choose credit vs no-credit, and a no-show path that can consume a session.
- A transactional `pt_sell_package` RPC (charge reference + pass insert + adjustment row in one call) to replace client-side inserts.
- Retire `use_pt_session` and the direct `sessions_remaining` update path (or make them route through `pt_adjust_pass_balance`).
- Reminder state columns/table for PT appointment and package-expiry reminders, plus new cron jobs.
- Optional: link `training_requests` to a client/appointment once converted.

**UI-only changes**
- PT section on the main admin member profile (packages, balance, upcoming/past sessions, unpaid PT) reading existing tables.
- Consolidate or remove the legacy `/admin/personal-training/*` pages in favour of `/admin/pt/*`.
- Surface PT charges in the member Payments tab from existing `manual_charges` data.
- Member / non-member portal: request-a-session entry point feeding the existing appointment record.

## 7. Risks

- Removing the legacy passes page without replacing its direct-edit affordance would remove a workflow staff currently rely on.
- Changing cancellation credit rules retroactively could alter balances; new rules should apply going forward only.
- Adding PT reminders risks duplicate sends if PT appointments are ever also represented in class/spa reminder queries — the new job must key off `pt_appointments` alone with a per-appointment sent marker.
- Volume is currently small (6 packages, 55 appointments, 9 usage rows, 0 adjustments), so migrations are low-risk now and will be riskier later.

## 8. Recommended Phase 2 scope

1. Make session usage fully auditable and appointment-linked (no deletes).
2. Single sanctioned write path for balances; retire the direct-update and `use_pt_session` paths.
3. Transactional package sale RPC so a Stripe charge can never lose its package.
4. Staff-chosen cancellation outcome + no-show handling.
5. PT block on the main admin member profile.
6. PT appointment / expiry / low-balance reminder automation with its own sent-marker.

Phase 2 is not started. Approve to move on, or tell me which items to reorder or drop.
