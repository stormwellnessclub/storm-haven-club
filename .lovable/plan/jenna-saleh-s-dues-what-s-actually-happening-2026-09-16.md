# Jenna Saleh's dues — what's actually happening

Good news first: **Jenna Saleh's payments are going through.** Her $250 Gold monthly dues have been paid every month, including the most recent one on **August 21, 2026**. Her next charge is scheduled for **September 21, 2026**. Nothing is failing, and she owes nothing.

## Why the admin screen looks wrong

Jenna has **two customer records in Stripe**. Her monthly dues subscription sits on one of them, but her member profile in the app is pointed at the other one.

The nightly billing sync looks up payments using the customer record saved on her profile. Because the dues live on the other record, the sync finds no dues subscription for her and leaves her payment history blank — which is why the last thing you see is an older one-off charge instead of her August dues. Her profile even carries the warning "Active member with no dues subscription in Stripe," which is false.

This is not unique to her: **16 active members** currently show no dues subscription on their billing snapshot, and at least two of them (Jenna Saleh, Layale Makki) carry that same false warning.

## The fix

1. When the billing sync cannot find a dues subscription under the saved customer record, look the subscription up **directly by its subscription ID** (which is already stored on the member) instead of giving up.
2. When that lookup succeeds and the subscription belongs to a different customer record, **correct the customer ID on the member profile** so every later lookup — payment history, card on file, arrears, retry buttons — points at the right place.
3. Pull the paid/failed invoice history from the customer the subscription actually bills, so the "last payment" date on the member page is accurate.
4. Re-run the sync for all members afterwards so the 16 affected profiles refresh, and re-check the false "no dues subscription" warnings.

No charges are created, refunded, or retried by any of this — it only corrects what the app reads from Stripe.

## Technical detail

- `supabase/functions/sync-membership-truth/index.ts` currently resolves everything from `members.stripe_customer_id` (subscription list at line ~101, customer retrieve ~149, invoice list ~165). Add a fallback: if no dues subscription is found, `stripe.subscriptions.retrieve(m.stripe_subscription_id)`, then use `sub.customer` as the authoritative customer for the customer/invoice lookups and write it back to `members.stripe_customer_id`.
- Same fallback applies to the annual-fee subscription (`annual_fee_subscription_id`).
- Verified example: member `52452419-0073-4d74-9bfb-c1e1cfcef841`, profile customer `cus_U2PEGjr7OVZYjo`, dues subscription `sub_1T3MrPLyZrsSqLhsEHfQ2d40` billing customer `cus_TyLYVByIstyoEy`, status `active`, latest invoice paid 2026-08-21, period ends 2026-09-21.
- `billing_arrears` already records her paid dues through Aug 21, so the arrears ledger is correct; only the snapshot/history view is wrong.
