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
- Kiosk/front-desk RPCs (`kiosk_*`) are thin guarded wrappers that call `PERFORM public.assert_kiosk_staff()` then delegate to a `*_impl` function. The `_impl` functions have EXECUTE revoked from `anon` AND `authenticated` — never grant them directly, and never add a kiosk RPC without the wrapper + guard.
- `assert_kiosk_staff()` requires `auth.uid()` plus one of super_admin/admin/manager/front_desk/cafe_staff/spa_staff/childcare_staff/class_instructor. Kiosk devices get this via the `kiosk-session` edge function (front_desk role), never via the anon key.
- `frontdesk_event_ticket_check_in` and `admin_delete_trainer` deny anonymous callers.
- Stripe member-identity actions resolve the member from `auth.uid()` (`resolveOwnedMember`); `bindCustomerToMember` never overwrites an existing `stripe_customer_id`. Payment methods supplied by the caller are verified as attached to that customer before use.
