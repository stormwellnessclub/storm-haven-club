# The Member Movement Edit ($160) — members-only offer

Add a fourth package to The Movement Edit on The Seasonal Edit page. Only active members can buy it. Your wording is used exactly as written.

## What the member gets
- **10 class credits for themselves.** They expire 3 months after purchase and are kept apart from their membership classes and the regular $170 package.
- **1 guest class credit.** It only works for bringing a non-member friend to a group class. It can't be used for the member's own classes, and it can only be used once.
- **$10 café credit.** It goes into the café credit balance they already have and runs out on the same 3-month date.
- Everything they bought, and every date, is set from the moment the payment goes through.

## Website (The Seasonal Edit page)
- The package appears as "Offer 04 — The Member Movement Edit, $160" next to the three non-member offers, in the same style and with your photos.
- **Members:** see the "Select Package" button, then the same review screen as the other offers (conditions, price, payment processing fee, total), then Stripe checkout and a "Payment received" screen.
- **Non-members and people not signed in:** see "Reserved for members" plus the sign-in link. They can't buy it.
- The three non-member offers now say "Non-members only" to members, so members aren't shown packages they can't buy.

## Bringing a friend (member portal)
- A new card, "Bring a friend," shows the guest credit and its use-by date.
- The member picks an upcoming group class with open space and enters their friend's name, email and phone.
- The friend's spot is booked under normal class capacity. The guest credit is used the moment the spot is saved, and it can never be used twice.
- If the member cancels in time, the credit comes back, using the same rules as normal class cancellations.
- The friend gets the usual booking confirmation by email and text (text only if they agreed to receive texts). It includes a link to create an account and sign the waiver before class.
- The friend must be a non-member. Members and anyone on the block list are turned away.

## Staff view
In Admin → Class Pass Pricing → The Seasonal Edit, the new package gets its own on/off switch and dates, starting off (draft) like the others. For each buyer, staff see three things separately:
- Personal classes left
- The guest credit: unused, or used and for which friend and class
- The café credit: amount left and expiration date

The member's profile shows the same three items.

## Unchanged
Regular prices ($170 member / $285 non-member), membership class benefits, and the other three offers.

## Technical details
- `seasonal_class_offers` gets `audience = 'member'` (allowed values extended) plus `guest_class_credits` and `cafe_credit_cents` columns. A new draft row is added: `member_movement_edit`, 16000 cents, 10 classes, 90 days. Eligibility (`seasonal_class_offer_block_reason`): an active `members` row matched by user/email, never a cancelled membership.
- The personal credits are one `class_passes` row with the offer key (the current path).
- The guest credit is a new `seasonal_guest_class_credits` table: buyer, pass_id, expires_at, status, redeemed booking/guest details. It gets GRANTs and RLS (owner reads their own; staff read all; writes only through SECURITY DEFINER RPCs).
- RPC `redeem_seasonal_guest_class_credit(class_session, guest name/email/phone)`: locks the credit row, checks it hasn't expired, that the friend is not a member and not blocked, and that the class has space. It then creates the `class_bookings` row and marks the credit redeemed in one transaction. A partial unique index blocks double use. Cancelling a booking in time restores the credit through the existing cancel path.
- Café credit: the webhook adds a grant through `adjust_cafe_credit` with a reason that names the package. Add a nullable `expires_at` to `cafe_credit_ledger`. A self-removing one-time timer at expiry posts an expiry adjustment for whatever is unspent (no polling). The balance view respects it.
- The webhook's `seasonal_class_pack` branch issues all three items idempotently, keyed by payment intent. The Stripe line item is labeled "The Member Movement Edit — 10 classes + guest class + $10 café credit," with the fee as its own line.
- UI: `MovementEditSection` (4th offer + member gating), a portal "Bring a friend" card, and the admin tab columns. Copy goes in `movementEdit.ts`.
- Tests: member-only eligibility, expiry 90 days, the guest credit can't be used twice, and the $160 fee is $5.15.
