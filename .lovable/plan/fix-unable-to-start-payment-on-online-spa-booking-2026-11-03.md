# Fix "Unable to start payment" on online spa booking

## What I found

- When someone taps Continue, the booking system checks the request first: is the treatment bookable online, is the time still open, is the date allowed, has this email tried too many times. If any check fails, it says no.
- **The website throws that answer away.** Every "no" shows up as the same message, "Unable to start payment. Please try again.", so the guest never learns why and you can't either. A test request I sent just now confirmed it: the system answered with a clear reason, and the website would have shown only the generic error.
- No attempt from your screenshot was recorded, so it was turned down by one of those checks before any payment was started. **Which check is still unconfirmed.** The likely ones:
  - **Too many tries:** after 6 attempts in an hour with the same email, all further tries are refused. Testing, or a guest who keeps retrying, hits this quickly.
  - **The time offered isn't really open:** the times on the calendar and the final check use slightly different rules, so a time can show as open and then get refused.
  - **A signed-in phone with an expired session** gets refused too.
- Separately, guests who did reach the card screen (Paula Pettway, LeLoni Myers, Alieu Njie) never entered a card. Every Back-and-retry leaves an "Incomplete" payment in Stripe.

## The plan

1. **Show the real reason** on screen, in plain words. For example: "That time was just booked, please pick another", or "Too many attempts, please call the club". Never the generic message.
2. **Record every refused attempt** (who, treatment, time, reason) so staff can see why someone couldn't book and call them back.
3. **Find and fix the cause behind your screenshot** using those records plus a test on an iPhone-sized screen with your exact treatment and time. No real payments are made.
4. **Make the calendar and the final check use the same rules**, so a time is never offered and then refused.
5. **Make the retry limit fair:** going back or retrying the same booking no longer counts as a new attempt. A real limit stays in place against abuse.
6. **Expired sign-ins:** refresh quietly, or fall back to guest checkout, instead of refusing.
7. **Card step clean-up:** one payment per booking attempt, the earlier unpaid one cancelled when a guest goes back, Apple Pay and Google Pay added, and a "Did you mean gmail.com?" check for email typos.
8. **Unfinished online bookings list for staff** next to spa requests, showing name, phone, email, treatment, time, and why it stopped, so staff can call. Paula, LeLoni and Alieu will be on it. Nothing is sent automatically.

What stays the same: prices, vouchers and gift cards, the card hold, slot reservation, intake and waiver links, and the confirmation emails and texts.

## Technical details

- `SpaBookingModal.startGuestCheckout`: on `FunctionsHttpError`, read `error.context.json()` and show its `error` field; use the generic fallback only for network failures.
- `spa-guest-checkout` `create`: insert into a new `spa_guest_checkout_rejections` table (staff-only RLS) with reason code, service, date, time, email and whether the caller was signed in, before every non-2xx reply. Count the retry limit by distinct service+date+time per email, and reuse the checkout id for the same selection.
- Slot parity: move the window, cleanup and conflict rules into a shared helper used by both the slot list (`get_spa_busy_slots`/availability) and `create`; add tests for a time at the end of a window that includes cleanup.
- Signed-in token failure: refresh the session on the client and retry once; if it still fails, use guest authorization.
- Card step: cancel the previous unpaid PaymentIntent on Back or when the selection changes; allow wallets; register `stormwellnessclub.com`/`www` as payment method domains. Add `src/lib/emailTypo.ts` with tests.
- Staff panel reads pending checkouts plus rejections from the last 14 days and hides test emails.
- Replace the guest spa checkout rule in AGENTS.md: server rejections are always shown verbatim and logged.
