# Command 0A — Verification & Gap Closure

Verification-first. No Phase 0B, no Stripe redesign, no billing feature work.

## What verification already found (checked against live code and database)

Confirmed **still open** 0A gaps:

1. **Member-identity payment actions accept and trust `memberId`.**
   - `create_activation_checkout`, `create_subscription_payment_intent`, `create_setup_intent` all resolve the Stripe customer from the caller's email (`getOrCreateCustomer`) and then write `stripe_customer_id` onto whatever `members.id` the request supplied — no ownership check, and an existing customer on that member is silently overwritten.
   - `create_subscription_from_payment` reads the member row by caller-supplied `memberId` and creates a subscription on it with no check that the row belongs to `auth.uid()`.
   - Test A (User A supplies Member B's UUID) currently **fails** for all four.

2. **`assertSubscriptionAccess` accepts email-only ownership.** `callerStripeCustomerIds()` adds every `members.stripe_customer_id` whose email matches the caller's email, regardless of `user_id`. Shared/duplicate emails therefore grant subscription access. Gate C fails.

3. **`charge_nonmember_saved_card`** correctly resolves the customer from the caller's own profile, but a caller-supplied `paymentMethodId` is passed straight to Stripe without verifying it is attached to that customer.

4. **Kiosk containment is not actually proven.** Current privileges:
   - `anon` EXECUTE still granted on `kiosk_acknowledge_conversation` and `kiosk_support_notification_counts`.
   - Every operational kiosk RPC (`kiosk_todays_attendance`, `kiosk_search_visitors`, `kiosk_class_roster`, `kiosk_kids_care_roster`, `kiosk_check_in_member/guest/class/spa/kids_care`, `kiosk_check_out_kids_care`, `kiosk_cafe_active_orders`, `kiosk_update_cafe_order_status`, `kiosk_adjust_member_credits`) is EXECUTE-able by **all authenticated users** and contains **no internal staff-role check**. Any signed-in member can check people in or adjust credits. Gate B/G fail.

5. **`frontdesk_event_ticket_check_in` still has the reported defect** — the role check runs only `IF v_uid IS NOT NULL`, so a null-uid caller skips it.

6. **Internal token hygiene.** No token literal exists in application source (good), but the token value was written into `cron.job` command text and appeared in a prior conversation. It must be treated as exposed and rotated.

Confirmed **already correct**: `requireTrustedCaller` rejects public keys; `sync_nonmember_card_metadata` has no caller-supplied customer fallback; `list_application_payment_methods` is authenticated and ownership-scoped.

## Work to do

### A. Member-identity payment actions
Add a single shared `resolveOwnedMember(memberId)` helper used by all four actions:
- Resolve the member from `auth.uid()` (`members.user_id = auth.uid()`); staff callers may pass an explicit target and get an `admin_action_log` row.
- If a `memberId` is supplied and does not match the caller-owned member, deny with a generic error and log `stripe_authz_denied`.
- Never write `stripe_customer_id` when the row already holds a different customer — fail closed, log the mismatch, preserve the original binding (Test C).
- Only bind a customer when the member row's current value is null or already equal (Test B).
- `create_subscription_from_payment` additionally requires the resolved member's stored customer to match the payment intent's customer.

### B. Non-member charge
In `charge_nonmember_saved_card`, retrieve the supplied payment method and require `paymentMethod.customer` to equal the profile-resolved customer; otherwise deny.

### C. assertSubscriptionAccess
Drop the email branch from `callerStripeCustomerIds`. Ownership becomes `auth.uid()` → `members.user_id` / `non_member_profiles.user_id` → `stripe_customer_id` → subscription customer. Email is retained only as a *narrow legacy recovery* path: a member row whose `user_id IS NULL` and whose email matches — and in that case the row is linked to the caller (`user_id` set) before access is granted, so it becomes an immutable relationship. Rows already owned by another `user_id` never qualify.

### D. Kiosk containment (migration)
- `REVOKE EXECUTE ... FROM anon` on `kiosk_acknowledge_conversation` and `kiosk_support_notification_counts`.
- Add an internal staff-role guard (`has_any_role(auth.uid(), ['super_admin','admin','manager','front_desk'])`, plus the relevant department roles where the current UI needs them) to the top of every operational kiosk RPC listed above, denying when `auth.uid()` is null. Kiosk devices already hold a real front-desk session via `kiosk-session`, so PIN-gated tabs keep working.
- Fix `frontdesk_event_ticket_check_in` so the null-uid case is denied rather than skipped.
- Before each change, confirm the current caller path so the UI fails closed, not sideways.

### E. Monitoring and token
- Add a minimal structured start/finish/deny log line (function, correlation ID, outcome, sanitized error category) to the 0A cron functions, and report which mutation-heavy jobs currently have idempotency and which do not — without redesigning the job architecture.
- Rotate `INTERNAL_TASK_TOKEN` and re-point cron commands at the rotated value; if rotation cannot be completed from here it is listed as an outstanding production action rather than marked done.

### F. Evidence gathering for the report
- Full 21-job cron inventory (name, target, active, auth mechanism, runtime result) plus the disabled `mothers-day-reconcile-every-5min`.
- Privilege table for every kiosk/front-desk function, before and after.
- Negative tests: anon key, wrong token, User A vs Member B, shared-email subscription access, anonymous and ordinary-member kiosk calls, Stripe test-mode non-member cross-customer charge.
- Reconciliation counts (currently 179 members and 117 non-member profiles with Stripe customers) captured before and after, plus subscription and activation-state counts; any unexplained delta stops the release.
- Typecheck, lint, build, edge-function and SQL validation — each reported with its real result, or `NOT RUN — infrastructure unavailable`.

## Deliverable

`COMMAND 0A — FINAL VERIFICATION REPORT` with sections 1–11 and the A–L release-gate matrix, each gate backed by evidence. Then stop.

## Technical notes

- All database changes ship as new forward migrations with documented rollback; no historical migration is edited.
- No live charges, refunds, or cancellations; Stripe test mode only.
- Frontend edits limited to no longer sending caller-controlled member/Stripe IDs and handling fail-closed states.
