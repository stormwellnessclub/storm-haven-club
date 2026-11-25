# Show Seasonal Edit (Black Friday) massage prices when staff book

## Why you don't see them
Right now the Seasonal Edit massage prices only exist as **gift purchases** in the shop. When staff book a massage in Admin → Spa, the booking screen only uses the regular menu price, so the Seasonal Edit price never appears.

## What changes
In the staff massage booking screen:
- When the chosen massage is part of the Seasonal Edit and the offer is still running (through Nov 30), a **"Use Seasonal Edit price"** switch appears, showing the price, for example "Seasonal Edit · $120 (was $150)".
- The switch is **off by default**. Staff turn it on when the client is getting the offer.
- **Members** booking their own massage get the Seasonal Edit price minus their tier discount (Silver 5%, Gold 8%, Platinum 10%, Diamond 12%). **Non-members and guests** get the listed Seasonal Edit price.
- That price is saved on the appointment, so checkout charges it. Booking the massage for **Friday or any later date** works, as long as you book it by Nov 30.
- After Nov 30 the switch goes away by itself.
- The prices come from the same list as the shop: 60-min Signature/Deep Relief $120, 90-min $170, 60-min Sports $160, 60-min Lymph $150, 90-min Sports/Lymph $180, Prenatal $150/$195.

Nothing is charged or sent while this is built.

## Technical details
- `AdminSpaBookingModal.tsx`: load active `gift_card_offers` (class_offer_key null, inside starts_at/ends_at) and match the selected service through `covers_service_ids`. When the switch is on, set `service_price`/`member_price` to the offer price (member: `memberTierRate` discount), and add a note "Seasonal Edit price" on the appointment.
- Small helper with tests: matching an offer to a service, member tier math, and hiding the switch after Dec 1 04:59 UTC.
- No database changes.
