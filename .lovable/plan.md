# Birthday Gift Card: 3 Ozone Sauna Sessions (Barb → Melody)

Goal: send Melody Nichols a branded birthday gift card email for **3 Ozone Sauna Sessions** from Barb Kovach, with no dollar value shown anywhere, already paid outside the app, and preview shown before anything sends.

Both people are non-members, so the current tool (which sells a card from a member profile and always prints a dollar amount) needs two small upgrades first.

## 1. Service-only gift cards (no dollar value)

Add a "show as service, hide dollar value" option to gift cards:
- Card preview and the recipient email show the service name — "3 Ozone Sauna Sessions" — in place of the big dollar figure.
- Email subject becomes "You've received a Storm Wellness Club gift card" instead of naming an amount.
- The card still carries an internal dollar balance for accounting/liability, just never displayed to the recipient.

## 2. Issue a card for a non-member buyer

Add an "Issue gift card" action on the Gift Cards hub that doesn't require a member profile:
- Buyer name + email typed free-form (Barb Kovach, bjkd@sbcglobal.net).
- Recipient name + email, personal message, expiry, send now or scheduled.
- Payment method "already paid / external" with an optional reference — no card is charged.
- Live preview panel, and an explicit **Preview → Send** step so nothing goes out until it's approved.

## 3. This specific card

Once the above is in place, I'll fill it in and show you the preview:
- From: Barb Kovach (bjkd@sbcglobal.net)
- To: Melody Nichols (melodynicholssong@icloud.com)
- Gift: 3 Ozone Sauna Sessions
- Message: "Happy Birthday, Dear Melody!!! This gift represents his multiplication of the double portion, including his healing. So happy you are here in the wellness storm. Love you high low always, Barb and Tim."
- Payment: already collected — recorded as external, no charge
- Send: immediately after you approve the preview

You mentioned you'll add the ozone credits to Melody's account yourself, so the card acts as the gift notification and redemption record rather than auto-granting sessions.

## Technical notes

- `gift_cards`: use existing `service_label` for the wording, add a `hide_amount` boolean (default false).
- `GiftCardPreview.tsx`: when `hideAmount`, render the service label as the hero text.
- `send-email` `gift_card_delivery` case: honor `hideAmount` for both the hero block and the subject line; add the same to `gift_card_purchase_receipt`.
- `create-gift-card` edge function: accept `hideAmount`, `serviceLabel`, and non-member purchaser fields (`purchaserName`/`purchaserEmail` with no `purchaserMemberId`); keep the staff-role guard.
- New `IssueGiftCardDialog.tsx` (reuses `SellGiftCardDialog` logic minus the card-on-file charge path), launched from `src/pages/admin/GiftCardHub.tsx`.
- Redeploy `create-gift-card` and `send-email` after the changes.
