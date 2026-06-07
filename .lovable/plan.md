
## Goal

Create new monthly Stripe dues subscriptions for **Sherene Albosaraj** and **Jeree Spicer** so they actually get billed going forward. Both currently have `stripe_subscription_id = NULL` after past cancellations.

## Member facts (verified from DB)

| Member | Tier | Gender → price | Card | Stripe customer |
|---|---|---|---|---|
| Sherene Albosaraj | Gold | women → **$250/mo base** | •••• 1642 | `cus_TtOsmHEP7aEKZw` |
| Jeree Spicer | Gold | women → **$250/mo base** | •••• 7193 | `cus_TuXPZdIkORPvQO` |

Processing fee gross-up is applied as a separate recurring line item by the existing code (matches their old arrears amounts: Sherene $250 flat, Jeree $257.55 with fee).

## How

The edge function `stripe-payment` already has the exact action we need: **`admin_create_member_subscription`** (line 2807).

It does everything correctly:
- Looks up tier/gender price from `STRIPE_PRODUCTS`
- Attaches saved card as `default_payment_method`
- Adds recurring processing-fee line item via `addRecurringProcessingFeeItems`
- Writes `stripe_subscription_id` and resets `subscription_status` to `active`
- Optional `firstChargeDate` to defer the first charge

So **no code changes needed** — just two invocations.

### Execution

For each member, call `supabase.functions.invoke('stripe-payment', { body: ... })` with:

```json
{
  "action": "admin_create_member_subscription",
  "memberId": "<id>",
  "tier": "Gold",
  "gender": "women",
  "billingType": "monthly",
  "isFoundingMember": false,
  "startDate": "<today>",
  "firstChargeDate": "<first charge date — see below>"
}
```

### Critical decision: when does the first new charge hit?

Their **arrears for past months (Mar–Jun) stay in the `billing_arrears` ledger** and are collected separately via the existing "charge arrears" flow (step 1 of the bigger plan). The new subscription is for **future months only**.

Two choices for `firstChargeDate`:

- **A. Charge today** — they immediately get billed for the current/upcoming cycle. Cleanest, no missed months going forward, but back-to-back with whatever arrears collection you also run.
- **B. Defer to July 1 (or next 1st of month)** — gives breathing room, aligns billing to month start.

I recommend **B (defer to the 1st of next month)** so arrears can be addressed independently without two charges hitting on the same day.

## After the subscriptions are created

1. Confirm the new `stripe_subscription_id` is on each member record.
2. Confirm `subscription_status = 'active'` on each.
3. The persistent red "$X owed" banner stays until step 1 of the larger plan (charge arrears) is completed — that is correct and expected.

## Out of scope for this step

- Charging the existing $2,077.68 in arrears (separate step).
- Touching Mariam/Ayah — they already have `incomplete` subs, handled in step 1 next.
- Emails/SMS — separate outreach step.

## Question for you

Confirm:
1. **First-charge date** — defer to **July 1** (recommended), or charge **today**?
2. Both Sherene & Jeree confirmed as **Gold / women pricing ($250 base + fee)** — correct?
