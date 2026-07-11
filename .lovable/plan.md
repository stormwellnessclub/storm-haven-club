## The bug

In `supabase/functions/stripe-webhook/index.ts` (the `invoice.payment_succeeded` handler for monthly dues, roughly lines 2618–2702), monthly credits are created using the **invoice's** `period_start` / `period_end`.

When a payment lands **late**, that invoice still describes the original billing window — e.g. an invoice covering "Jul 1 – Jul 31" that is only paid on Aug 5. The webhook then inserts credits with `expires_at = Jul 31`, so they land in the database already expired. To the member the credits look like they were never added.

There's also no cross-check against the member's actual current cycle from Stripe, so the collision guard (`.eq('cycle_start', cycleStartStr)`) uses the wrong cycle_start when the invoice period is stale.

## The fix

Edit the credit-renewal block inside `invoice.payment_succeeded` in `supabase/functions/stripe-webhook/index.ts` so credits always align with the member's **live** cycle:

1. Retrieve the subscription: `stripe.subscriptions.retrieve(invoice.subscription)`.
2. Compute `cycleStart` / `cycleEnd` from `subscription.current_period_start` / `subscription.current_period_end` (fall back to the item-level values Stripe uses on newer API versions, then to the invoice period as a last resort).
3. If the resulting `cycleEnd` is still in the past (edge case: subscription hasn't ticked yet), roll the cycle forward: `cycleStart = today`, `cycleEnd = today + 30 days`. Never issue credits with `expires_at < now()`.
4. Keep the existing "credits already exist for this cycle" guard, but query it against the corrected `cycle_start` so re-runs stay idempotent.
5. Add a `logStep("Late payment detected — using live subscription cycle", …)` when the invoice period was in the past, so this is visible in edge logs.

No other code paths change: annual-fee invoices, Kids Care renewals, dunning recovery, `billing_arrears` upsert, and the tier-downgrade branch all keep their current behavior.

## Backfill for members already affected

After the webhook fix ships, one-off reconcile for members whose last successful dues payment happened after their invoice's `period_end`:

- Query `payment_attempts` (status `succeeded`, `charge_type = membership_dues`) joined against `member_credits` to find members with no unexpired credits despite a recent paid dues invoice.
- For each match, insert current-cycle credits using the same tier map used in the webhook (`TIER_CREDITS`), with `cycle_end` set from their live Stripe `current_period_end`.

I'll surface the list for review before granting anything so nothing gets double-credited.

## Verification

- Check `stripe-webhook` edge function logs for the new "late payment detected" line after the next past-due recovery.
- Spot-check one affected member in `member_credits`: `expires_at` should be in the future and `credits_remaining` should reflect their tier.
- Confirm the member sees the credits in the portal (Wellness / Class booking screens).

## Scope guardrails

- Only touches the monthly dues credit branch. Annual fee, Kids Care, tier downgrades, dunning, blocked-person refunds, and arrears logic are untouched.
- No schema changes and no changes to `process-monthly-credits` cron.