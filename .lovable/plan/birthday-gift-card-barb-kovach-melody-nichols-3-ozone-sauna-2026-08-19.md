# Birthday gift card: Barb Kovach → Melody Nichols (3 Ozone Sauna Sessions)

Issue a service-only gift card that shows "3 Ozone Sauna Sessions" instead of a dollar value, with Barb's birthday message, using the existing Gift Cards → Issue Gift Card tool. Nothing is emailed until you approve the on-screen preview.

## Card details to enter

- Purchaser: Barb Kovach, bjkd@sbcglobal.net
- Recipient: Melody Nichols, melodynicholssong@icloud.com
- Service label: 3 Ozone Sauna Sessions
- Hide dollar amount: on (recipient sees the service, not the price)
- Value on file: $255.00 (3 × $85 Ozone Sauna, current menu price) — this is the redeemable balance behind the scenes and stays hidden from Melody
- Payment method: External / Other, marked already collected — no charge is run
- Expiration: 1 year from issue
- Message: "Happy Birthday, Dear Melody!!! This gift represents his multiplication of the double portion, including his healing. So happy you are here in the wellness storm. Love you high low always, Barb and Tim."

Both people are non-members, which the issue tool already supports — no account is created for either of them.

## Steps

1. Open the issue form with the details above filled in and hidden-amount turned on.
2. Render the email preview (no send) so you can read the exact message and layout Melody will receive.
3. On your approval, create the gift card record and send the email.
4. Confirm the code appears in the Gift Cards list as active with the external-payment note and the birthday message attached.

## Two things to confirm before sending

- Value on file: $255 assumes today's $85 Ozone rate. Tell me the actual amount Barb paid if it differs and I'll use that instead.
- Expiration: 1 year is the default — say the word if you want a different date or no expiry.

## Technical notes

Uses the existing `IssueGiftCardDialog` and the `create-gift-card` edge function with `hide_amount: true`, `service_label`, `purchase_source: 'admin'`, and `payment_method: 'external'`. The preview path calls `send-email` in preview mode, which renders the template without delivering. No schema or function changes are needed.
