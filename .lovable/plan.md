# Gift Cards: Public Purchase, Redemption & Tracking

Builds on the existing gift card system (codes, scheduled delivery, member "My Gift Cards" page, admin sale from a member profile) by adding a real storefront, a code-redemption path, and a full admin tracking hub.

## 1. Public gift card store (`/gift-cards`)

A branded page anyone can view; purchase requires sign-in (guests are prompted to log in / create an account, then the in-progress purchase resumes automatically — same pattern already used for class pass checkout).

Buyer picks:
- **Amount** — preset tiles ($50 / $100 / $150 / $250) or custom amount ($25–$1000).
- **Or a service** — curated tiles like "60-Minute Massage — $120", "5-Class Pack — $150", "Recovery Day Pass — $60". Each is a labeled preset; the card is issued as dollar value so it can be used on anything, with the service name shown on the card and in the email.
- **Recipient** name + email, optional **personal message**, and optional **send date** (send now or schedule).
- Live preview of the card as the recipient will see it.

Payment is an embedded Stripe card form inside the page (no redirect off-site), matching the event ticket flow. On success the buyer sees an in-app confirmation, gets a receipt email, and the recipient gets the gift email immediately or on the scheduled date.

## 2. Redeeming a code

- **Online checkout:** a "Have a gift card?" field on member/non-member checkouts (class passes, cafe orders, spa/recovery bookings, event tickets). Entering a valid code validates the balance, applies it to the total, and if the card fully covers the purchase no card charge is made. Partial balances leave the remainder on the card.
- **Front desk / admin:** a "Redeem gift card" action in POS and on a member profile — enter code, see balance, apply an amount to the sale, with a note field.
- Every use writes a redemption record (amount, remaining balance, what it paid for, who processed it) so cards can be audited.

## 3. Admin Gift Cards hub (`/admin/gift-cards`)

A single searchable page listing every card issued (public purchases, admin sales, and comped cards):
- Search by code, recipient name/email, or purchaser.
- Filters: status (scheduled / sent / active / partially redeemed / fully redeemed / cancelled / expired), date range, source (online vs front desk).
- Summary stats: total sold, total redeemed, outstanding liability, scheduled for delivery.
- Row detail drawer: full card info, delivery timeline, personal message, redemption history, and actions — resend email, reschedule, adjust expiry, void/cancel, manually redeem, and add internal notes.
- CSV export for accounting (outstanding liability is a real balance-sheet item).
- Ability to issue a card directly from admin (existing dialog, reachable from this hub too) including cash / Clover / comp payment methods.

## 4. Emails

- **Recipient gift email** — branded card with amount or service name, code, personal message, sender name, expiry, and a link to view the card online.
- **Purchaser receipt** — confirmation of what was bought and when it sends.
- Existing scheduled-send job continues to handle future-dated cards.

## Technical notes

- Extend `gift_cards` with `service_label`, `purchase_source` (`online` / `front_desk` / `admin` / `comp`), `stripe_payment_intent_id`, and allow `payment_method = 'stripe_online'`.
- New edge functions: `create-gift-card-checkout` (creates PaymentIntent, holds a pending card row) and `confirm-gift-card-purchase` (activates the card and triggers delivery on payment success). Reuse the existing `create-gift-card` path for admin/front-desk sales.
- New security-definer RPCs: `validate_gift_card_code(code)` (returns balance/status without exposing other cards), `redeem_gift_card(code, amount, applied_to_type, applied_to_id, notes)` (atomic balance decrement + redemption row + status transition), and `admin_gift_card_search(...)` for the hub.
- RLS: buyers see only their own cards (existing `get_my_gift_cards`), recipients can look up by code only through the validate RPC, staff roles get full read via `has_any_role`.
- Reuse `GiftCardPreview.tsx` for the store, portal, and admin preview. New `RedeemGiftCardField` component shared across checkouts.
- Add `/gift-cards` to the sitemap with proper title/description for SEO.
