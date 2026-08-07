# Command 0A — Final Release Gate Evidence

No new audit was performed and no code was changed. Everything below is evidence read from the current codebase and live database, plus one remaining defect that needs a fix before 0A can close.

## 1. Member-to-member Stripe authorization

**NOT RUNTIME VERIFIED.** No safe non-staff synthetic identity exists: creating a test auth user + member row + Stripe customer would be a live mutation in the production backend, which is out of scope for a verification pass. No member-vs-member runtime test was run, and none is claimed.

Server-side ownership path, per action (`supabase/functions/stripe-payment/index.ts`):

- `get_subscription` (1853), `cancel_subscription` (1867), `pause_subscription` (3396), `resume_subscription` (3421), `update_subscription_billing` (3440) all call `assertSubscriptionAccess(subscriptionId, action)` (745-779) before any Stripe read or mutation.
- That guard retrieves the subscription from Stripe, extracts its bound `customer` id, and requires that id to be in `callerStripeCustomerIds()` (713-741), a set built only from `members.stripe_customer_id where user_id = auth.uid()` and `non_member_profiles.stripe_customer_id where user_id = auth.uid()`.
- Failure returns a generic "Subscription not found" (no existence leak) and writes `stripe_authz_denied` to `admin_action_log`.
- Staff (`super_admin/admin/manager`) bypass the ownership check and every such call is written to `admin_action_log` as `stripe_subscription_staff_action`.

## 2. The four member-identity payment actions

All four accept `memberId` in the body; none trust it as authorization. `auth.uid()` comes from `supabase.auth.getUser(bearer token)` (626-632). Ownership is resolved by `resolveOwnedMember()` (785-823): for a non-staff caller it loads only rows where `members.user_id = auth.uid()` and uses the supplied `memberId` merely to pick among those rows — a foreign id yields "Member not found" plus a `stripe_authz_denied` audit row. Stripe customer binding goes through `bindCustomerToMember()` (827-853), which throws if the member already has a different `stripe_customer_id` (audited as `stripe_customer_rebind_blocked`) and only writes when the column is currently NULL.

| Action | memberId trusted | User A can target Member B | Customer can be rebound by caller input |
| --- | --- | --- | --- |
| `create_activation_checkout` (947-978) | No | No | No |
| `create_setup_intent` (2828-2852) | No (optional; falls back to own row) | No | No |
| `create_subscription_payment_intent` (3458-3486) | No | No | No |
| `create_subscription_from_payment` (3531-3579) | No (also verifies `paymentMethodId` belongs to the resolved customer) | No | No |

Staff override: roles `super_admin/admin/manager/front_desk` and kiosk-PIN mode may pass an arbitrary `memberId`; each use is audited as `stripe_member_staff_action`. `charge_nonmember_saved_card` (7521-7581) takes no `memberId` at all and resolves the customer strictly from `non_member_profiles.user_id = auth.uid()`.

Invariant holds. No fix required here.

## 3. assertSubscriptionAccess ownership algorithm

Can email equality alone authorize access? **NO.** The guard compares Stripe customer ids only. Email appears in one narrow legacy-recovery branch of `callerStripeCustomerIds()` (717-728): a `members` row with `user_id IS NULL` matching the caller's email is first linked (`user_id = auth.uid()`) and only then contributes its customer id — access is always granted through the immutable `user_id` relationship, never by email match. Rows already owned by another user are never touched.

## 4. Monitoring evidence

| Signal | Mechanism | State |
| --- | --- | --- |
| Denied Stripe authorization | `admin_action_log` rows: `stripe_authz_denied`, `stripe_customer_rebind_blocked` | Persisted (186 rows, last 2026-07-31) |
| Staff Stripe mutations | `admin_action_log`: `stripe_subscription_staff_action`, `stripe_member_staff_action` | Persisted |
| Denied internal-function invocation | `requireTrustedCaller.ts:26-36` `console.warn` of `{evt:"privileged_call_denied", fn, reason, at}`; kiosk denials raise Postgres `42501` from `assert_kiosk_staff()` | Console/exception only, not persisted |
| Scheduled job success/failure | `cron.job_run_details` plus `payment_tracking_health_log` (82 rows, last 2026-08-07 11:00) | Persisted |
| Duplicate execution | Not prevented generically | See below |

Duplicate-execution classification: `class-pass-reconcile`, `process-abandoned-class-pass-checkouts`, `process-expired-waitlist`, `process-scheduled-gift-cards`, `stripe-webhook` (via `processed_webhook_events`) are **idempotent** (state-guarded selects). `payment-tracking-health-check` and the nightly billing rebuilds are **monitored** (health-log rows). Reminder senders (`send-class-reminders`, `send-spa-reminders`, `process-promotion-emails`) are **monitored** only via run details, relying on sent-flag columns.

Log sanitisation: `logStep` passes every payload through `redactForLog`/`SENSITIVE_LOG_KEYS` (446-466), redacting `authorization, apikey, token, access_token, client_secret, pin, card, number, cvc, email, phone, body, payload`, depth-limited to 2 and strings capped at 120 chars. The entry-point log of the full request body (501) is redacted. No raw client secret, card number, or unredacted body was found in any log path. Residual note: the redactor is a key blocklist, not an allowlist.

## 5. Migration / database change record

| File | Change | Rollback |
| --- | --- | --- |
| `20260807095000_*.sql` | Revoked EXECUTE from PUBLIC/anon on `_staff_pin_hash`, `generate_mothers_day_code`, `pt_is_staff`, `pt_is_staff_or_desk` | Re-GRANT EXECUTE |
| `20260807102217_08a4c2fc-*.sql` | Added `assert_kiosk_staff()`; revoked EXECUTE on 14 `kiosk_*_impl` functions; recreated 14 public `kiosk_*` wrappers that call the guard then the impl; recreated `frontdesk_event_ticket_check_in` to deny anonymous callers | Restore prior function bodies from git history; wrappers keep identical signatures so no client change is needed |
| `20260807102254_a7d14fc6-*.sql` | Revoked EXECUTE on `admin_delete_trainer(uuid)` from PUBLIC/anon | Re-GRANT EXECUTE |
| `20260807013412_*.sql` | Added `kiosk_acknowledge_conversation` / `kiosk_support_notification_counts` wrappers (superseded by the 1022 migration) | Drop functions |

No `cron.schedule`/`alter_job` statements appear in any 0A migration; the previously reported Job 2 repair was applied directly against the production database, not through a migration — **this is the one direct production change without a migration record, and it did not take effect** (see blocker).

## 6. Reconciliation

Aggregates only, no PII: members 197 · with Stripe customer 179 · distinct customer ids 179 · members sharing a customer id **0** · non-member profiles with a customer 117 · duplicate non-member customer ids **0** · members with a subscription id 124 · status split active 120 / cancelled 69 / frozen 7 / past_due 1 · members touched in the last 3 days 15 (13 active, 2 frozen — ordinary operational churn, no bulk status flip).

**NO UNEXPLAINED RECONCILIATION DRIFT DETECTED.** No Stripe customer reassignment, no subscription reassignment, no mass membership-status change, no payment-method reassignment.

## 7. Regression checks

- Typecheck: **PASS** (`tsgo --noEmit -p tsconfig.app.json`, no diagnostics)
- Lint: **NOT RUN — not executed this pass**
- Build: **NOT RUN — build runs in the platform pipeline, not manually**
- Edge Function validation: **PASS** by static read; no deploy performed
- Migration/SQL validation: **PASS** — the three 0A migrations are applied and their objects exist in the live database

## Final release matrix

| Gate | Result | Evidence |
| --- | --- | --- |
| A — Public keys cannot invoke internal automation | PASS | `requireTrustedCaller.ts:87-94` rejects anon/publishable keys; adopted by 18 internal functions |
| B — Anonymous callers cannot invoke kiosk functions | PASS | `assert_kiosk_staff()` wrappers; `_impl` EXECUTE revoked from anon/authenticated |
| C — Ordinary users cannot access another user's Stripe objects | NOT RUNTIME VERIFIED | Code path proven (section 1/3); no safe synthetic non-staff identity |
| D — Member-facing payment actions derive identity securely | PASS | `resolveOwnedMember` + `bindCustomerToMember` on all four actions |
| E — Non-member Stripe identity cannot be caller-supplied | PASS | `charge_nonmember_saved_card` resolves customer from `non_member_profiles.user_id` only |
| F — Application payment methods not anonymously enumerable | PASS | `list_application_payment_methods` authenticated-only |
| G — Staff-only actions verify staff on backend | PASS | `isStaffCaller` / `assert_kiosk_staff` / `user_roles` checks |
| H — Expired campaign automation disabled | PASS | cron job 9 `mothers-day-reconcile-every-5min` is `active = false` |
| I — Monitoring sanitized and operational | FAIL | Cron job 2 has failed every day since 2026-08-05 |
| J — Database changes documented with recovery | FAIL | The Job 2 cron repair was applied directly with no migration and is not in effect |
| K — Available regression checks pass | PASS | Typecheck pass; lint/build not run |
| L — No unexplained Stripe/Postgres/member drift | PASS | Section 6 aggregates |

## Blocker and the one fix proposed

`cron.job_run_details` shows job 2 `process-guest-feedback-emails` failing at 10:00 UTC on 2026-08-05, 08-06 and 08-07 with:

```text
ERROR: relation "public.scheduled_functions_config" does not exist
```

The job body still reads its URL and token from the dropped `scheduled_functions_config` table, so the earlier repair never landed. Every other job succeeded in the last 3 days.

**Proposed change — one migration, nothing else:**

1. `cron.unschedule('process-guest-feedback-emails')`.
2. Re-schedule it at `0 10 * * *` using the same literal-URL + `x-internal-task-token` (read from Vault) pattern the other 22 jobs use — no reference to `scheduled_functions_config`.
3. Rollback: unschedule and re-create from the prior definition in `cron.job` history.

No application code, no edge function, and no other database object is touched.

## Recommendation

**COMMAND 0A NOT YET CLEARED FOR PHASE 0B.**

Blockers:
1. Gate I/J — scheduled job `process-guest-feedback-emails` is failing daily against a dropped table, and its repair was applied directly to production without a migration record.
2. Gate C is NOT RUNTIME VERIFIED, by design; it clears only if you accept static proof, or authorise creating a disposable synthetic non-staff account for a read-only `get_subscription` denial test.
