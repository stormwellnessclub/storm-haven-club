# Gate C — Runtime Verification (read-only)

Close the last open Command 0A gate by proving at runtime that an ordinary authenticated member cannot read another member's Stripe subscription.

## What the test does

1. Create one disposable auth user (synthetic Member A) with a throwaway address on a non-real domain and a random generated password. No real member credentials, no Stripe customer, no membership row, no roles.
2. Sign in as that user to obtain a normal member JWT.
3. Pick an existing subscription id that belongs to a different member (read-only lookup of one `members.stripe_subscription_id` value; the id itself is never shown in the report).
4. Call the `stripe-payment` function with `action: get_subscription` and that subscription id, using Member A's JWT.
5. Record the HTTP status and the exact response body.

## Expected outcome

- Response is the generic denial ("Subscription not found") with no subscription object, customer id, payment method, amount, or status leaked.
- One `stripe_authz_denied` row appears in `admin_action_log` for the attempt, and its payload is sanitized.
- No Stripe write of any kind: no cancel, pause, resume, billing update, payment, or refund. `get_subscription` is a read path and the guard runs before Stripe is touched.

## Verification after the call

- Re-read the `admin_action_log` denial row and confirm the recorded fields.
- Re-run the reconciliation counts used in the release evidence (members with Stripe customer, distinct customer ids, members sharing a customer id, subscription status split) and confirm they are unchanged from the pre-test snapshot taken in the same run.

## Cleanup

Delete the synthetic auth user after the test. The `admin_action_log` denial row is left in place as evidence. If deletion is blocked by a dependent row, the account is left disabled and that is stated plainly rather than silently skipped.

## Safety boundaries

- Read-only action only (`get_subscription`). No mutating action is invoked.
- No real member account is signed into, and no real credential is used or displayed.
- No subscription id, customer id, or email appears in the final report.

## Result handling

If the denial behaves as expected, update the release matrix: **Gate C — PASS — runtime verified**, then **COMMAND 0A FULLY CLOSED — CLEARED FOR PHASE 0B**, recorded in the Command 0A evidence document. If the call returns anything other than a generic denial, the gate is reported FAIL with the observed response and no closure is claimed.

Phase 0B is not started.

## Technical notes

- Guard under test: `assertSubscriptionAccess` (`supabase/functions/stripe-payment/index.ts:745`), backed by `callerStripeCustomerIds` (:713), reached from the `get_subscription` case (:1847).
- Denial audit path: `auditPrivileged('stripe_authz_denied', ...)` (:771).
- Synthetic user is created via the admin auth API and removed the same way; no schema change, no migration, no application code change.
