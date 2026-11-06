# Classes experience and booking overhaul

## What the audit already shows
- **Signed-out visitors hit a dead end.** Tapping Book shows "Please sign in or create an account" and a "Sign In to Book" button. That sends them to a generic sign-in page, and the class they picked is not carried through reliably.
- **Accounts with no pass see a red error.** The box reads "No payment method available" and lists Diamond credits first, then sends people to Memberships. That is a membership pitch in the middle of booking a class.
- **The schedule page's opening copy is wrong for first-timers.** It mentions yoga (not launched) and "riders" for Reformer. It also offers a guest day pass, which doesn't include classes, and says "Sign in to book your spot."
- **Bookings are not zero, but nearly none come from new visitors.** In the last 7 days there were 24 pass bookings and 12 class passes bought, plus 33 staff holds. Most of the roughly 2,300 schedule visits came from Instagram, and those visitors left after about 3 seconds.
- **There is no funnel tracking yet.** We can't see where visitors drop off between tapping Book and paying.

## Phase 1: Fix the booking path (highest priority)
1. **One booking flow that keeps the class on screen.** "You're booking: Reformer, Saturday, 10:30 AM, with the instructor and studio" stays at the top of every step.
2. **New visitors:** "New to Storm Wellness? Single class, live price, Continue." Then a short form (first name, last name, email, phone, password), the waiver and the card, all in the same window. Paying creates the account, buys the pass and reserves that exact class in one go, then shows the confirmation.
3. **Existing accounts:** "Already have an account? Sign in" happens inside the same window and returns straight to the same class.
4. **No pass on file:** replace the red error with "Add a single class, or the 10-class pack, for this booking." No membership pitch.
5. **Confirmation screen:** "You're in", with the class details, when to arrive, grip socks, parking, the cancellation rule and Add to calendar. First-timers also get "What to expect".
6. **Prices come from the database only**, with member and non-member prices shown separately.
7. **Safeguards:** a double tap can't create two bookings. If a sign-in expires or a payment fails, the class stays selected.

## Phase 2: Schedule page
- Opening: "Find your class." Members and non-members are welcome, and new visitors can buy a single class while they reserve.
- Rows show time, class, instructor, length, level, heated or not, spots left and Book. Rating and details come second.
- Simple filters: studio, day, level, heated, instructor. They are sized for a thumb, with no sideways tables.
- Remove the yoga, "riders" and guest day pass wording.

## Phase 3: Classes page and class pages
- Editorial layout matching the homepage: a real studio photo first, "Small classes. Serious coaching." and "View this week's schedule".
- Live rating line (currently 5.0 from 181 reviews) and a few short reviews sitting in the page between sections, never floating.
- Studio sections for Reformer, Cycling and the third studio. I'll suggest a better customer-facing name than "Aerobics", without renaming anything behind the scenes.
- "Help me choose", built only from real active classes.
- First-visit guide: arrive, wear, bring, tell your instructor, during class, and what non-members can use after class.
- Instructors shown with typography only: name, what they teach, one line and "View upcoming classes".
- Each class page covers what to expect, level, length, heated or not and upcoming sessions, each with direct booking.
- Clean up the class list: wrong categories, Cycling shown as Pilates, empty descriptions, durations and capacities.

## Phase 4: Tracking and messages
- Track every funnel step you listed, plus booking errors as separate events. This feeds an admin funnel report: visitors, schedule viewers, Book taps, checkouts, payments, reservations.
- Check that each message is actually being sent: receipt, booking confirmation, reminder, first-class prep, waitlist, cancellation and review request. I'll report what exists and fill the gaps.

## Testing (before anything ships)
- Run every scenario you listed (A–G, plus failed payment, double tap, sign-in midway, session expiry) on phone and desktop. Each gets a PASS, FAIL or BLOCKED.
- Payments use Stripe test cards and test accounts only. No real customers are changed and no real reminders go out. Test bookings are removed afterwards.

## Needed from you
- Your preferred customer name for the third studio (suggestion: "Strength & Movement Studio").
- Class photos with people in them, when available.

## Technical details
- A new `ClassCheckoutFlow` replaces the signed-out and no-pass branches of `BookingModal.tsx`. The selected session id travels with the Stripe payment.
- A server function finalises the purchase: on payment success it creates the account, then the pass, then the booking, all at once (`create_atomic_class_booking`), keeping the existing waiver and phone rules.
- `Schedule.tsx`, `ScheduleBrowser.tsx`, `Classes.tsx` and `ClassTypeDetail.tsx` are rebuilt on `components/editorial`.
- Funnel events are registered as `project.*` events and logged with the existing visitor-analytics system. The admin funnel report reads those events plus `class_bookings`.
