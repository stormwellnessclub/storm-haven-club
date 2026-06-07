# Fix auto-cancelled members + close the cancel-on-failure gap

## Part 1 — Stop billing from cancelling subs on failure (root cause)

Per project policy Stripe Smart Retries already leaves failed subs as `past_due`, and the webhook ignores `customer.subscription.deleted` for dues. **One remaining loophole**: `stripe-webhook` still flips a member to `cancelled` when a dues subscription returns status `incomplete_expired` (first invoice never collected). That's how a brand-new sub gets killed silently if the first charge fails.

Change (webhook `customer.subscription.updated` branch, ~line 2008):
- For **dues** subs: on `canceled` / `incomplete_expired`, set `members.subscription_status='past_due'` and `members.status='past_due'` instead of `cancelled`. Log an admin alert; never null out `stripe_subscription_id`.
- For **annual fee** subs: behavior unchanged.

Also harden `charge-member-arrears` so a failed `invoices.pay` does **not** rely on the sub still being active — already correct, but we'll also allow the function to fall back to a fresh `PaymentIntent` against the saved card + reconcile to the matching `billing_arrears` row when the original Stripe invoice was voided by cancellation. This is what makes "retry now" actually work for these 4.

## Part 2 — Rewrite arrears to match Stripe-verified truth

Per-member dues amount = each member's most recent successfully-paid recurring dues invoice (already gross-up'd):

| Member | Tier | Per-month | Cycle day | Owed months |
|---|---|---|---|---|
| Mariam Alsheeblawy | Silver | $200.00 | 15th | Apr (Mar 15–Apr 15), May (Apr 15–May 15) |
| Sherene Albosaraj | Gold | $250.00 | 9th | Mar, Apr, May |
| Ayah Boussi | Silver | $206.29 | 10th | Apr, May |
| Jeree Spicer | Gold | $257.55 | 4th | May, Jun |

Steps:
1. **Resolve** every existing `unpaid` row for these 4 members with `resolution_reason='superseded_by_admin_correction_2026_06'`. (Keeps audit trail; drops them from the dunning view.)
2. **Insert** new `billing_arrears` rows exactly matching the table above: `billing_type='membership_dues'`, `status='unpaid'`, `period_start` = cycle day, `period_end` = +1 month, `amount_due_cents` per the table, `stripe_invoice_id=NULL` (these are admin-created, not Stripe-originated).
3. Set the 4 members to `status='past_due'`, `subscription_status='past_due'`, `payment_past_due=true`, `payment_past_due_since=now()` so the red owed banner shows everywhere.

## Part 3 — Reinstate the recurring dues subscriptions

Mariam (`sub_1TfZOB…`) and Ayah (`sub_1TfSx2…`) already have current Stripe subs in DB — verify they're `active`/`past_due` (not cancelled) and reattach if needed. After Part 1's fix, future failures won't kill them again.

Sherene and Jeree have no sub. Create new monthly dues subs:
- `customer = stripe_customer_id`, `default_payment_method` = their saved card.
- `items[0].price` = same Stripe price they were on before (look up from last paid invoice line item).
- `billing_cycle_anchor` = next cycle day in `America/Chicago` (Sherene → 2026-07-09, Jeree → 2026-07-04).
- `proration_behavior: 'none'`, `collection_method: 'charge_automatically'`.
- Write `stripe_subscription_id` + `next_billing_date` back to `members`.
- The new arrears rows from Part 2 are **separate** from Stripe — collected via the existing "Charge saved card" admin button (Part 1's hardening makes that work even though the original invoices were voided).

## Part 4 — Hold all outreach

Nothing dunning-related (email/SMS/auto-retry) fires from this plan. The admin still has to click "Charge saved card" or "Send reminder" per row in `/admin/billing-arrears` after you confirm the rewritten list.

## Verification

After execution, re-pull `/admin/billing-arrears` (Dues filter). Expected list:
- Ayah Boussi — 2 rows · $412.58
- Jeree Spicer — 2 rows · $515.10
- Mariam Alsheeblawy — 2 rows · $400.00
- Sherene Albosaraj — 3 rows · $750.00
- **Total owed: $2,077.68**

Confirm subs in Stripe: 4 active monthly dues subs anchored to the right days.

## Files touched (build phase)

- `supabase/functions/stripe-webhook/index.ts` — neutralize cancel/incomplete_expired path for dues
- `supabase/functions/charge-member-arrears/index.ts` — fallback to PaymentIntent for admin-created arrears (no Stripe invoice)
- Data ops via `insert` tool: resolve old arrears, insert corrected ones, update 4 members
- Stripe ops: create 2 new subscriptions (Sherene, Jeree)
