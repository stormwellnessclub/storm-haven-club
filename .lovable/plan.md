# Lymphatic Body Roller — Member Presale Campaign

## What members get
A presale page plus a campaign of four polished emails. They use your three machine photos, the maroon/espresso/gold Storm look, and no stock or AI images.

Campaign emails:
1. **Launch:** the presale is open.
2. **Halfway reminder:** around day 15.
3. **Last chance:** 2–3 days before the sale ends.
4. **Machine arrived:** goes only to buyers, telling them booking is open.

Each email is sent only when you press its button. Nothing sends on its own.

Member presale prices (regular prices shown crossed out):

| Option | 30 min | 60 min |
|---|---|---|
| Single session | $35 (reg. $49) | $70 (reg. $90) |
| 5-Pack | $150 | $325 |
| 10-Pack | $300 | $600 |

- Every option, singles included, expires 6 months after purchase.
- The presale ends Nov. 11, 2026, and you can change that date.
- Note shown on the page and in the email: "Estimated arrival early November. Arrival date subject to change."
- Wording follows the house rules: no "free" and no "buy tickets."

## How buying works
- Members pay online by card, with the 6% Michigan tax and the card fee added the usual way.
- The sessions go into their account and appear on their Credits page as "Body Roller — reserved."
- Booking opens once the machine arrives and staff turn on booking.
- Only active members can buy. Cancelled members are excluded. Non-member pricing will come later as a separate sale.

## Admin
- A new "Body Roller Presale" card in Admin → Marketing shows a list of buyers, which option each bought, the total sold, and a CSV export.
- Email controls follow the Sound Bath pattern: Preview, Send test (defaults to stormfitnessllc@gmail.com), then Send to active members.
- The member send skips anyone who already got the email, and it only goes out when you press the button.
- Emails come from and reply to admin@stormwellnessclub.com.

## Testing safety
Testing uses Stripe test mode and test sends only. No real member is emailed or charged until you send it yourself.

## Technical details
- Upload the 3 photos through lovable-assets so both the page and the email can use them.
- Add a `body_roller` service to the existing credit/pass system: a new `class_passes`-style row with `expires_at = purchased_at + 6 months` and a sessions count. Single sessions count as 1 and record the duration (30/60).
- Create 6 Stripe prices for the presale. A new edge function `purchase-body-roller-presale` checks that the buyer is an active member server-side (client flags are ignored), uses card priority chosen → default → newest, and records the pass once payment succeeds.
- A new edge function `send-body-roller-presale-email` supports preview, test, and blast modes. It sends through Resend with a branded HTML shell, logs recipients for idempotency, and targets active members only.
- Presale page: `/body-roller-presale`, with a link from the member portal.
