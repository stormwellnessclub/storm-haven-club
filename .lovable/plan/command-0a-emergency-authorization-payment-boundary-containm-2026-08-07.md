# Command 0A — Emergency Authorization & Payment Boundary Containment

Containment-only release. No pricing, billing, portal, or architecture changes.

## Verified current state (checked before planning)

- `supabase/functions/_shared/requireTrustedCaller.ts` **still** treats `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_DEFAULT_KEY` as trusted "cron" callers. `INTERNAL_TASK_TOKEN` already exists as a secret and is already accepted via `x-internal-token`.
- `process-session-generation` (and siblings) independently accept `Bearer <anon key>`.
- `stripe-payment/index.ts` (8,325 lines): `get_subscription` and `cancel_subscription` take a caller-supplied `subscriptionId` and act on it with **no ownership check**. `pause_subscription`, `resume_subscription`, `update_subscription_billing`, `create_subscription_payment_intent`, `create_subscription_from_payment`, `create_activation_checkout`, `create_setup_intent` need per-action review against the same rule.
- `sync_nonmember_card_metadata` still contains the fallback `nmProfile?.stripe_customer_id || body.stripeCustomerId`.
- `list_application_payment_methods` is explicitly unauthenticated and keyed only on a Stripe customer ID.
- `logStep("Processing action", body)` logs the **entire request body** for every call.
- Kiosk containment is largely **already done**: no operational kiosk RPC (attendance, visitor search, rosters, check-in/out, café orders, credits, event tickets) currently grants EXECUTE to `anon`. Remaining anon-executable items needing action: `admin_delete_trainer`, `_staff_pin_hash`, `kiosk_acknowledge_conversation`, `kiosk_support_notification_counts`, `generate_mothers_day_code`.
- `mothers-day-reconcile-every-5min` (jobid 9, `*/5 * * * *`) is still active. 22 cron jobs total, all invoking edge functions with the public anon key in the header.

## Work to be done

### 1. Internal / scheduled caller trust
- Rewrite `requireTrustedCaller.ts`: accept only (a) `x-internal-task-token` matching `INTERNAL_TASK_TOKEN`, (b) the service-role key, (c) a verified staff JWT with an allowed role. Delete all anon/publishable acceptance.
- Sweep every function under `supabase/functions/` for the same pattern and remove it: `process-session-generation`, `process-freeze-expirations`, `process-monthly-credits`, `process-payment-dunning`, plus any other match found in the sweep. Standardise them on `requireTrustedCaller`.
- Keep `x-internal-token` accepted alongside the new header for one release so no job breaks mid-deploy; note it in the report.

### 2. Cron re-authentication
- New forward migration re-creating each affected job's command so the internal token is read from Supabase Vault (`vault.decrypted_secrets`) and sent as `x-internal-task-token` — no literal secret in SQL.
- The vault entry itself is populated out-of-band (not in a migration). If it cannot be provisioned automatically, the report lists the exact manual step.
- Same migration disables `mothers-day-reconcile-every-5min`. Other jobs are reviewed and reported; only unambiguously expired campaign jobs are disabled.

### 3. Stripe object ownership
For each of `get_subscription`, `cancel_subscription`, `pause_subscription`, `resume_subscription`, `update_subscription_billing`:
- Resolve member from `auth.uid()` → `members` → `stripe_customer_id` server-side, retrieve the subscription, and require `subscription.customer` to equal that customer before returning or mutating.
- Staff path goes through the existing `assertStaff` with an explicit target member and an audit row.
- Any action whose ownership cannot be proven without redesign is disabled with a controlled 403 and documented rather than left open.

For `create_activation_checkout`, `create_setup_intent`, `create_subscription_payment_intent`, `create_subscription_from_payment`:
- Derive/validate the member from `auth.uid()` instead of trusting `body.memberId` (staff calls keep an explicit, role-checked target).
- Never overwrite an existing `stripe_customer_id` with a differing resolved customer — fail closed and log the mismatch.

### 4. Non-member identity
- Remove the `|| body.stripeCustomerId` fallback in `sync_nonmember_card_metadata`; resolve or server-side create the customer from the authenticated non-member profile.
- `charge_nonmember_saved_card`: verify the payment method is attached to that verified customer before charging.

### 5. Application payment-method enumeration
- `list_application_payment_methods` fails closed (403, controlled error) unless authenticated ownership of the application can be established cleanly with existing infrastructure. Frontend shows a graceful "temporarily unavailable" state. Where it is retained, the response is minimized to brand / last4 / expiry — no payment-method IDs.

### 6. Remaining anon RPC grants
- New migration: `REVOKE EXECUTE ... FROM anon` on `admin_delete_trainer`, `_staff_pin_hash`, `kiosk_acknowledge_conversation`, `kiosk_support_notification_counts`, `generate_mothers_day_code`, and add an internal staff-role check inside the kiosk support functions.
- Re-verify `frontdesk_event_ticket_check_in` denies when `auth.uid()` is null (fix the branch if it still short-circuits).
- Before each revoke, confirm the current production caller so the frontend fails closed rather than sliding to another unsafe path.

### 7. Logging
- Replace `logStep("Processing action", body)` with an allowlisted field log (action, actor id, sanitized target). No secrets, client secrets, tokens, or full bodies anywhere.
- Reuse the existing `admin_action_log` table for denied privileged calls and staff financial mutations; add a narrow append-only structure only if it proves unsuitable.

### 8. Verification
- Negative auth tests (anon key, no token, wrong token, member-vs-member Stripe access, anonymous kiosk RPC calls) run against the deployed functions and the database.
- SQL permission checks re-run after the migrations.
- Typecheck, lint, and build.
- No live charges, refunds, or cancellations — Stripe test mode / static verification only.
- Reconciliation counts (members with Stripe customers, active subscriptions, membership states) captured before and after; any unexplained delta stops the release.

## Deliverable

A `COMMAND 0A COMPLETION REPORT` with sections A–N, including the release gate matrix and any outstanding manual production configuration (vault entry / token rotation / redeploys).

## Technical notes

- All permission, grant, and cron changes ship as **new** forward migrations named for 0A containment, each with a documented rollback.
- No historical migration is edited; no historical financial data is deleted.
- Frontend edits are limited to no longer sending caller-controlled Stripe/member IDs and to handling the fail-closed states.
