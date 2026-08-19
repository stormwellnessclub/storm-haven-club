# Send Melody's Birthday Gift Card

The preview is approved. Next step is to actually create and email the gift card.

## What gets created

- Recipient: Melody Nichols (melodynicholssong@icloud.com)
- Purchaser on record: Barb Kovach (bjkd@sbcglobal.net)
- Gift: 3 Ozone Sauna Sessions (service-only card, dollar amount hidden)
- Hidden value on file: $255.00 (3 x $85)
- Expires: August 19, 2027
- Payment: external / already collected — no charge is run
- Custom message: Barb's birthday note, exactly as provided

## How it will be done

Issue the card through the existing gift card flow (`create-gift-card` edge function) with
`hide_amount: true`, `service_label: "3 Ozone Sauna Sessions"`, and
`purchase_source: external`, then trigger the gift card email (`send-email`) to Melody with
the custom message — the same path the approved preview rendered.

No code changes are required; this is a one-time data + email action using the
already-built Issue Gift Card capability.

## Verification

- Confirm the gift card row exists with the hidden amount, service label, and 2027 expiry.
- Confirm the email send succeeded to Melody's address.
- Report the generated gift card code back to you.
