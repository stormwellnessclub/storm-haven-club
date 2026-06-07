# Expiring Card Alerts — Email, SMS, Portal Banner

Approved email copy from preview. SMS added (will troubleshoot delivery separately). Idempotency prevents duplicate sends per card per expiration period.

## 1. New `card_expiry_notices` tracking table

Tracks what's been sent so we never re-spam the same card/exp combo.

Columns: `member_id`, `stripe_payment_method_id`, `card_last4`, `exp_month`, `exp_year`, `email_sent_at`, `sms_sent_at`, `days_out_email` (60/30/7), `days_out_sms` (30/7).

Unique constraint: `(member_id, stripe_payment_method_id, exp_month, exp_year, days_out_email)` for email, parallel for SMS.

## 2. Email — added to `send-email/index.ts`

New type `card_expiring` using the approved copy:

> Subject: **Your card on file expires soon — update to avoid interruption**
>
> Hi {first_name}, the {card_brand} ending in {card_last4} expires {exp_month}/{exp_year}. Next charge: {next_billing_date} for ${next_amount}. [Update Payment Method] → /member/payment-methods. Reply or admin@stormwellnessclub.com.

## 3. SMS — added to existing `send-sms` function

Template (160 chars, A2P-compliant):

> Storm Wellness Club: Your card ending {last4} expires {MM}/{YY}. Update at stormwellnessclub.com/member/payment-methods to avoid interrupted billing. Reply STOP to opt out.

Only sent to members with `sms_consent = true`.

## 4. New edge function `check-expiring-cards` (daily cron, 9am CT)

Logic per active member with `stripe_customer_id`:
1. List Stripe payment methods, find default
2. Compute months-until-expiry from `exp_month/exp_year` vs today (America/Chicago)
3. Touchpoints:
   - **60 days out** → email only
   - **30 days out** → email + SMS
   - **7 days out** → email + SMS (final)
4. Skip if `card_expiry_notices` already has a row for `(member, pm_id, exp_month, exp_year, days_out_*)`
5. Skip if card was updated (different `pm_id` or different exp)
6. Write `billing_outreach_logs` entry per send

Cron: pg_cron job hits the function once daily.

## 5. Member portal banner `CardExpiringNotice`

Shown on `/member` and `/member/membership` when default card expires ≤60 days:

- **Amber** for 31–60 days, **red** for ≤30 days
- Text: "Your {brand} ending {last4} expires {MM}/{YY}. Update to avoid interruption."
- Button: "Update Card" → `/member/payment-methods`
- Dismissible per-session, returns next page load
- Sits above `PaymentDueNotice` / `AnnualFeeNotice` in banner stack
- Uses new hook `useCardExpiryStatus` that queries Stripe default PM via existing `useAdminMemberPaymentMethods`-style edge function (new `get-member-card-expiry`)

## 6. Admin visibility

"Card Expiring" badge column on `/admin/billing-arrears` and member detail when card expires ≤60 days (amber/red).

## Technical Notes

- Idempotency: DB unique constraint on `card_expiry_notices` is the source of truth — INSERT with `ON CONFLICT DO NOTHING`, only send if insert succeeded
- Card replacement detection: if Stripe returns a different `pm.id` than last logged, treat as resolved and skip
- Timezone: all "days out" math in `America/Chicago`
- Stripe pagination: only checks default payment method, not all saved cards
- SMS opt-in respected: skips members without `sms_consent`

## Out of scope

- Bulk admin "send expiring notice" button (cron handles it)
- Actually fixing SMS delivery (separate troubleshoot)
- Notices for non-default secondary cards
