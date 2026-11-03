# Booking conversion roadmap

- [x] Include PT visits in check-in list, dashboard, history and daily report as a separate PT category, including members. Seven counting tests pass; isolated admin filter shows 14 PT rows. Live data confirms 14 arrivals November 2; live staff verification unavailable because the preview account lacks staff roles. No live visits changed.

- [x] Automated Google review requests: new completed non-member classes, member/non-member spa and staff-completed guest visits; 24h SMS/48h email minimum, 15/day daytime slots 48 minutes apart, 90-day person cooldown, consent and manual reviewer suppression. Google connection verified with 44 reviews. Isolated database tests and checklist save/read-back checked; live staff page verification unavailable because preview account lacks staff permissions. No live client messages or visits used in tests.

- [x] Add Jennie R and two one-time Cycle classes November 5 at 6 PM and November 7 at 1 PM; both verified on public schedule, 50 minutes and 10 riders, no invitations sent.

- [x] Identify Rhylie's $293.83 ten-class pack and add actual catalog/inline item names to all one-time stripe-payment Checkout Sessions; four isolated tests pass and function deployed, with no live purchases, messages or historical payment edits.

- [x] Restrict book club next-round self-signups to members through the shared member form and database policies; remove public name collection, preserve approved guests, verify signed-out page and three eligibility tests without live registrations or messages.

- [x] Book Fatine Anani’s requested October 30 seaweed wrap, 10:30 AM, 90 minutes, $290 unpaid; correct launch-date trigger type comparison and send account/intake setup email and consent-checked text from authorized staff account.

- [x] Fix reproduced guest spa checkout authentication rejection; deployed, 12 tests passed, safe live invalid-date request now reaches date validation rather than expired-session rejection. Full paid booking intentionally untested; no charges/reservations/messages.
- [x] Guest spa checkout accepts Mother's Day vouchers and Storm gift cards (card charged only for the rest; $0 bookings just save the card). Live code checks verified; no real voucher, gift card or card used in testing.
- [x] Save wet spa/class-pack research as paused; resume only at the owner's explicit request

- [x] Suppress and verify all 17 requested addresses; deploy system unsubscribe links and consent gates for ten legacy blasts, with six isolated tests passing. Old email replies still reach admin; inbox reply ingestion is not configured. Live admin roster verification was unavailable (unauthorized).

- [x] Restore Jessica's paid October 4 childcare pass (16 sessions through November 4) and deploy corrected renewal detection; three tests pass and booking eligibility verified from saved data; staff screen check unavailable because the preview account lacks admin access

- [x] Correct cancelled-occurrence conflict warnings and refresh cancellation summaries; three tests pass and November 15 data checked; live admin screen verification blocked by test-session permissions

- [x] Extend public and portal schedule visibility through November 30, 2026; verified live week navigation, calendar selection and both Maya classes on November 30, six tests passing, no booking or record changes

- [x] Add and verify Maya’s November 1–30 class schedule: 42 sessions across 10 weekly slots, Aerobics Studio, capacity 8, 50-minute sessions, no December recurrence; first November week verified on public schedule

- [x] Guest spa booking: choose time, enter contact/consent, inline card checkout and optional account setup
- [x] Post-booking service-specific intake and waiver without losing the reservation
- [x] Verify safely without real bookings, charges, or client messages — desktop/phone full guest journey with isolated payment/reservation responses; live invalid requests rejected; no real payment or account creation tested

- [x] Enable other active body wraps from October 29, preserving seaweed and keeping three inactive wraps hidden
- [x] Combine shorter/extended wrap choices and expand research-grounded benefits with references
- [x] Verify wrap choices and launch dates on phone and laptop without bookings or charges

- [x] Fix class-pass checkout return, booking crash, and pass selection; verified signed-in with real future class and simulated checkout/pass responses, no live payment or reservation

- [x] Spa "Book a Treatment" button scrolls to the menu
- [x] Sign-in returns clients to the treatment they picked and reopens booking
- [x] Sign-in from a class reopens that class's booking
- [x] Spa: show times before asking for waiver/card
- [x] Classes: buy a single class pass inside the booking window
- [x] Real /classes page (studios, what to expect, beginner FAQs)
- [x] Local search tags and business info for spa, massage and classes pages
- [x] Restore automatic staff-booked PT confirmation email and consent-checked text; safe mocked tests only (no client messages or real bookings)

## Campaign Studio
- [x] Phase 1: one campaign list, brand-locked email builder, text + picture, phone/laptop preview, tests, scheduling, calendar of all scheduled sends (incl. older ones, with Stop)
- [x] Phase 2 (part): AI writer in brand voice, brand check, saved audiences (Higher Self Society roster / no RSVP / RSVP yes, members, non-members, email list)
- [ ] Phase 3: funnels (follow-up steps) and opens/clicks/bookings results
- [ ] Phase 4: retire older one-off send panels once each is moved over
