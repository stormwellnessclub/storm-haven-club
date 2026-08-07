---
name: Internal automation auth (Command 0A)
description: Cron/edge-function trust model — public anon/publishable keys are never trusted; scheduled jobs use x-internal-token
type: constraint
---
- Public `anon`/publishable keys are NEVER a trust signal in edge functions. `_shared/requireTrustedCaller.ts` accepts only: `x-internal-token` (INTERNAL_TASK_TOKEN), the service-role key, or a staff JWT.
- All `pg_cron` jobs call edge functions with header `x-internal-token` (no Authorization/apikey header). New scheduled jobs must follow the same pattern.
- `stripe-payment`: every subscription action (get/cancel/pause/resume/update_billing) runs through `assertSubscriptionAccess`, which requires staff role or a Stripe customer owned by `auth.uid()`; denials are generic ("Subscription not found") and logged to `admin_action_log` as `stripe_authz_denied`.
- `list_application_payment_methods` is authenticated-only (staff or the applicant whose email matches the signed-in user). Never re-open it to anonymous callers.
- `sync_nonmember_card_metadata` resolves the Stripe customer only from the caller's own profile — no caller-supplied `stripeCustomerId` fallback.
- `logStep` in stripe-payment redacts sensitive keys and never logs raw request bodies.
