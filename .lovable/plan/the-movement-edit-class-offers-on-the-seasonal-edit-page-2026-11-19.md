# The Movement Edit — class offers on The Seasonal Edit page

## What visitors will see
A new **The Movement Edit** section on the Seasonal Edit page (`/black-friday`), below the Personal Training packages, using your exact wording:
- Header, subline and intro paragraphs as written.
- Three separate, editorial options (not a price grid): **The Discovery Pass** ($75, 3 classes), **The Movement Edit** ($255, 10 classes), **The Club Experience** ($285, 10 classes + club day pass).
- Each shows its short description, full package details, and its own button: "Explore Classes", "Select Package", "Experience the Club".
- Your uploaded photos placed full-width between/beside the offers (Reformer, cycling, strength, club). No countdowns, badges or discount banners. Never the word "sale".
- The Seasonal Edit strip and portal cards will also point non-members to these class offers.

## How buying works
- Sign in or make an account, review all conditions, then pay with the saved/new card through the existing Stripe checkout (same as current class passes, with the 6% tax and processing fee as today).
- After payment, credits appear automatically in the client's portal and work with the normal class booking — capacity limits and booking rules unchanged.
- **Discovery Pass:** only for people who have never booked or bought a class before; one per person. 3 credits, expire 21 days after purchase.
- **Movement Edit / Club Experience:** non-members only (cancelled members count as non-members). 10 credits, expire 2 months after purchase. They don't stack with each other.
- **Club Experience** also issues one club day pass automatically: single use, non-transferable, normal guest day-pass access only — no spa or separately priced recovery treatments.
- Expired credits can't be used; repeated payment notices never issue credits twice.
- Regular prices ($170 member / $285 non-member 10-class) stay unchanged.

## Staff side
In the existing admin class-pass area, a "Seasonal Edit" filter showing: buyers, package, credits left, expiration, Discovery eligibility check, day pass redeemed yes/no, usage history, and on/off switch plus start/end dates per package. Revenue by package comes from the existing revenue report (labeled clearly in Stripe).

## Safety
Built switched off (draft). I'll test every screen with charging blocked — no real purchase, nothing sent to clients. You turn it on when ready; visitors see it after publishing.

## Technical details
- New class-pass product rows (promo flag, audience, eligibility, credit count, expiry days, promo start/end) reusing `pilates_cycling` credit type; no edits to existing products.
- Checkout reuses the class-pass purchase edge function: server-side checks for non-member status and first-time eligibility (no prior class bookings/passes by user or email); Stripe metadata labels the package name.
- Webhook fulfillment idempotent on payment intent; Club Experience inserts one guest pass (existing guest pass system, `used_at` tracking).
- Photos uploaded as Lovable assets.
- Tests: eligibility rules, expiry days (21 / 2 months), one-time Discovery, single day pass issuance.
