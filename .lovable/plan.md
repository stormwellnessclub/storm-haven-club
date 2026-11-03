# Fix online spa bookings that stall at the card step

## What the records show (since Oct 30)

- 6 real "Incomplete" spa payments in Stripe from 4 people. Only Zainab Alsaid later got through (2nd try).
- Still lost: **Paula Pettway** (3 tries, Sat Nov 7), **LeLoni Myers** (today, Nov 3 at 1:30 PM), **Alieu Njie** (2 tries this morning, Nov 12 at noon; his email was typed as `gmail.co`, so our emails can't reach him).
- In every stalled attempt, **no card ever reached Stripe**: no decline, no card error. People reached the card screen and stopped there.
- Alieu's taps this morning (iPhone): opened the card screen, tapped Back after about 40 seconds, edited his details, opened it again, then left. He never tapped Pay.
- Every Back-and-retry creates a brand new Stripe customer and a new "Incomplete" payment. That's why Stripe shows a pile of them for one person.

**Still unconfirmed:** the exact reason people stop on the card screen. It could be the card form loading slowly or not at all on iPhone, the Pay button hidden below the keyboard, or plain confusion. Step 1 checks this before anything is changed.

## The plan

1. **Reproduce on an iPhone-sized screen first.** Open the guest booking window, watch whether the card form shows up, whether the Pay button can be seen and tapped with the keyboard open, and record what goes wrong. No real payments get created.
2. **Put the card form right on the booking details screen.** Guests type their contact details and card on one screen with one "Confirm & Pay" button. Stripe only records a payment when Pay is tapped, so opening the screen or going back no longer leaves "Incomplete" payments or extra customers behind.
3. **Add Apple Pay and Google Pay** next to the card form so iPhone guests can pay in one tap.
4. **Keep the Pay button visible on phones** at the bottom of the booking window, with any card problem shown in plain words just above it.
5. **Catch email typos** such as `gmail.co`, `gmial.com` or `yahoo.co` and ask "Did you mean gmail.com?" before going on.
6. **One payment per attempt.** If a guest goes back and changes the time, the earlier unpaid payment gets cancelled in Stripe so it doesn't sit there as "Incomplete".
7. **Unfinished bookings list for staff.** Next to the spa requests, show anyone who started an online booking but didn't finish: name, phone, email, treatment, requested time, and how far they got (form never loaded, card error and what it said, or left without paying). Staff can call them back. Nothing is sent automatically.
8. **Today:** Paula, LeLoni and Alieu show up in that list so staff can call them. I won't contact them myself.

What stays the same: prices, voucher/gift card coverage, the card hold for no-shows, the slot reservation, the intake and waiver links, and the confirmation emails and texts.

## Technical details

- `SpaGuestCheckout` / `SpaBookingModal`: switch to Stripe's deferred-intent Payment Element (`Elements` with `mode: 'payment'|'setup'`, `amount`, `currency: 'usd'`, `captureMethod: 'manual'`, `setupFutureUsage: 'off_session'`). On Pay: `elements.submit()` → `spa-guest-checkout` `create` → `stripe.confirmPayment({ elements, clientSecret, redirect: 'if_required' })` → existing `reserve`. Amount shown comes from a new read-only `quote` action (same pricing, member discount and coupon code as `create`); the server still decides the charged amount, and `reserve` still verifies it.
- `spa-guest-checkout`: allow card + Apple Pay/Google Pay (wallets via card); register `stormwellnessclub.com` and `www` as Stripe payment method domains. Reuse one checkout id per booking-window session; when service, date or time changes, cancel the previous unpaid PaymentIntent (idempotent) before creating the new one. Customer creation moves to the Pay step.
- New columns on `spa_guest_checkouts`: `form_loaded_at`, `pay_pressed_at`, `last_client_error`, `abandoned_reason`, written through a narrow `report` action authorized by the checkout's access token.
- Staff view: "Unfinished online bookings" panel reusing `useSpaServiceRequests` placement in admin and front desk (pending/never-booked checkouts from the last 14 days, test emails like `example.com`/`.invalid` hidden).
- `src/lib/emailTypo.ts` with tests (`gmail.co` → `gmail.com`, `gmial.com` → `gmail.com`, valid domains unchanged). Tests for quote/create amount parity and one-unpaid-payment-per-session.
- AGENTS.md rule replacing the guest spa checkout line: card collected before the PaymentIntent exists; one unpaid intent per guest session.
