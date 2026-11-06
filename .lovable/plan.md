# Spa Aella: experience, messaging and booking

## What I checked first (last 7 days)
- About 1,700 Spa page visits. 16 people started online checkout, 3 paid, and 12 appointments were made in total. There were no technical refusals, so most people stop before checkout rather than failing inside it.
- Most visitors arrive from Instagram and leave within about 3 seconds. The page currently opens with "Recovery Spa & Massage in Livonia" and a list of facilities, which is exactly what your brief says not to lead with.
- **Live menu vs. the brief:**
  - On the menu: Seaweed (Detox Seaweed & Charcoal Wrap, 70/90 min), Mud Therapy, Vitamin C, Collagen and Body Sculpting wraps, eight facials, six massages and recovery.
  - Not on the menu: Moroccan Clay Ritual, Alginate Body Treatment and Hot Stone Massage. I won't feature these until they're added. Hot stone can stay as an add-on mention only if it's offered that way.
  - Facials are request-only today, so "View Availability" for facials becomes "Request a time".

## Phase 1: Find where people drop off
- Track every step you listed, from spa_page_view to spa_confirmation_view, plus failures.
- Add an admin Spa funnel report: visitors, then category taps, then treatment views, then Book taps, then time chosen, then checkout, then paid, then booked. Each step shows the number who left.

## Phase 2: Rebuild the page in your order, with your copy
1. **Hero:** a real Aella photo, "The part of wellness you shouldn't have to earn.", Explore Treatments and View Availability.
2. **Experience:** "There is a difference between stopping and actually restoring."
3. **"What do you need today?":** four entrances (Massage & Bodywork, Facials, Body Treatments, Recovery), each with a different photo and layout rhythm. No identical cards.
4. **Pause:** "Not everything you do for your body has to be work." No button.
5. **Signature Experiences:** only treatments that are really on the menu. That's the Seaweed ritual for now, with your copy and no detox or slimming lead.
6. **Massage, Facials, Body Treatments, Recovery:** each with your headline and copy.
7. **The Aella Experience:** a large photo section of rooms, showers, stone, tile and steam.
8. **"Aella is open to you."**
9. **The menu:** "Choose what your body needs today." Rows show name, one line, minutes and price, then View Treatment and Book. Prices come live from the menu.
10. **One or two short atmospheric lines and one real review**, all in the flow of the page. Nothing floating.

## Phase 3: Booking feels like part of the experience
- "Let's find your time." A "You're booking" summary (treatment, minutes, price) stays visible at every step.
- Provider is optional, with "First available" as the default.
- The account step reads "Almost there." Checkout shows only the appointment and payment. The finish reads "You're booked." with arrival time, Add to calendar and View appointment, and no upsell.
- Swap system words like "purchase" and "redeem" for your booking language.

## Phase 4: Treatment pages
- Every treatment page answers the same questions: The experience, Why you might choose it, What to expect, Benefits (careful claims only), Before you arrive, Your appointment, Book.

## Testing
- Phone first. I'll run one full guest booking with a Stripe test card, then remove the test appointment. No real clients are touched.
- Check that nothing floats over or covers the Book buttons.

## Needed from you
- Should Moroccan Clay, Alginate and Hot Stone be added to the menu? If so, send prices and durations.
- Real photos: treatment rooms, hands-on massage, body-treatment application, product textures.

## Technical details
- Rewrite `src/pages/Spa.tsx` on `components/editorial`. Funnel events are added inside the existing handlers in `Spa.tsx`, `SpaBookingModal.tsx` and `SpaGuestCheckout.tsx`, and registered in `.lovable/events.json`.
- The admin funnel page reads visitor-analytics events plus `spa_guest_checkouts` and `spa_appointments`.
- Copy lives in one shared file, so the menu and treatment pages stay consistent.
