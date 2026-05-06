# Mother's Day — Fix voucher usability + gift email delivery

## What I found (root causes)

### 1. The voucher is invisible inside the member's app
- The voucher is **only sent by email**. Nothing surfaces it in `/portal` (non-member dashboard), `/member` dashboard, the `/spa` page, or inside `SpaBookingModal`.
- `SpaBookingModal` has **zero awareness** of `mothers_day_vouchers` — there is no code path, no input field, no auto-detect. So if a buyer tries to book their massage in-app, Stripe will charge them again. They'd have to call us — which is exactly what's happening.
- The DB has the linkage already: `buyer_user_id` is filled in for logged-in buyers (e.g. `beydounwafa@aol.com`), and we can also match by lowercased `buyer_email`.

### 2. Gift recipients never got the email — and we can't see why
Looking at the 8 voucher rows:
- 3 are gifts (have `recipient_email`).
- Of those, **2 are still `pending`** (Susan Hammoud, Mama A, Lama Kawar) — payment never completed *or* the buyer never landed on `/mothers-day/success`, so `mothers-day-confirm` never ran → voucher never activated → email never sent.
- The 1 active gift (Karen Yassine) was sent but went to the **buyer's** email (`diaa_alshara@yahoo.com`), not a separate recipient address.

Why this is fragile:
- Email delivery is wired entirely to the **client-side success page** (`mothers-day-confirm` is only called when the browser hits `/mothers-day/success`). If they close the tab, switch apps, or Stripe Link redirects oddly → no email, ever.
- There is **no `email_send_log` table** in the project — Resend is called directly. We have no record of who got what, no retry trail, no bounce visibility.
- One template handles both buyer-for-self and gift-to-recipient. The gift email isn't structured as a true gift card to the recipient.

---

## The fix

### Part A — Make the voucher usable inside the app

1. **New hook `useMyMothersDayVouchers`** — fetch active vouchers where `buyer_user_id = auth.uid()` OR `LOWER(buyer_email) = current_user_email_lower()`. Add an RLS policy so members can SELECT their own (currently service-role only).
2. **New `MothersDayVoucherCard` component** shown:
   - On `/portal/dashboard` and `/member` dashboard (replaces the marketing banner once a voucher is owned).
   - On `/spa` above the services list.
   - Card displays: gold/cream design, code, massage choice + duration, expiration, "Book your massage" CTA → opens `SpaBookingModal` pre-filled with the eligible massage.
3. **Wire voucher into `SpaBookingModal`**:
   - New optional prop `voucherCode`. When present, the modal:
     - Locks the service to the voucher's `massage_choice` + duration.
     - Skips the Stripe payment step (`appointment.payment_status = 'voucher'`, `appointment.metadata.mothers_day_voucher_id = …`).
     - On confirm, calls existing RPC `redeem_mothers_day_voucher(p_code, p_appointment_id)` server-side via a tiny new edge fn `mothers-day-redeem` (so we never trust the client to mark redeemed).
   - Add a **manual "Redeem voucher" entry point** on the spa page: text input → validates with `lookup_mothers_day_voucher`, then opens the modal in voucher mode. Useful for gift recipients who weren't logged in when buyer entered their email.
4. **Match-by-email backfill on signup/login**: trigger that, when an auth account is created, links any existing `mothers_day_vouchers` rows whose `buyer_email` or `recipient_email` matches the new user.

### Part B — Fix gift email delivery (root-cause, not a band-aid)

1. **Stripe webhook = source of truth for activation + email**
   - New edge function `mothers-day-webhook` listening to `payment_intent.succeeded` and `checkout.session.completed`.
   - Looks up the voucher by `metadata.voucher_id`, flips `pending → active`, and invokes `send-mothers-day-voucher`. Idempotent (checks status before re-sending).
   - The existing client-driven `mothers-day-confirm` call stays as a fast-path UX for the success screen but no longer the only path.
2. **Send to recipient AND buyer reliably**
   - Today the code already includes both addresses but in a single multi-recipient `to:`. Split into **two separate sends** so a bounce on one doesn't kill the other:
     - **Recipient email** = "gift card" style with the buyer named as the sender.
     - **Buyer email** = receipt + "we sent your gift to X" confirmation.
   - For non-gift purchases, only the buyer email goes out (unchanged).
3. **Two distinct branded templates** (`MothersDayGiftEmail` + `MothersDayReceiptEmail`):
   - Gift template: presented as a card from the buyer, large recipient name, gift message, voucher code, redemption instructions ("Sign in or redeem at the front desk / call us"), expiration, single CTA "Redeem your gift" → `https://stormwellnessclub.com/mothers-day/redeem?code=...` (a public landing that calls `lookup_mothers_day_voucher` then prompts sign-in/account-create or front-desk redemption).
   - Receipt template: thank-you, what they bought, code, expiration, CTA "Book your massage" or "Track your gift".
4. **Logging + visibility (lightweight, no new infra)**
   - New table `mothers_day_voucher_emails (voucher_id, kind, recipient_email, status, error, sent_at)`.
   - `send-mothers-day-voucher` writes a row per send attempt.
   - Admin tracker shows a per-voucher email status pill (Recipient ✅ / Buyer ✅ / ⚠ failed) with the timestamp, plus "Resend to recipient" / "Resend to buyer" buttons separately.
5. **Reconcile the 2 stuck `pending` gifts** (Susan Hammoud, Lama Kawar, Mama A):
   - One-shot admin button "Reconcile pending vouchers" → for each pending row with a `stripe_payment_intent_id`, query Stripe; if `succeeded`, activate + send the proper emails. If never paid, mark `expired_unpaid`.
   - I'll run this once after deploy and report which ones recovered vs which need a manual outreach.

### Part C — Public `/mothers-day/redeem?code=…` landing
- Lets recipients (who aren't members and aren't logged in) validate their code, see what's on it, and either:
  (a) sign up / sign in to attach the voucher to a member portal, or
  (b) just see "Bring this code to the front desk or call us to book".
- Same gold/cream brand as the email so it feels continuous.

---

## Technical details (for reference)

- **DB migrations**: RLS policy on `mothers_day_vouchers` (`SELECT` for owners by user_id or email); new `mothers_day_voucher_emails` table; trigger to auto-link buyer_user_id/recipient on auth account creation by email.
- **New edge functions**: `mothers-day-webhook` (Stripe webhook, no JWT), `mothers-day-redeem` (auth-required, calls RPC).
- **Edited edge function**: `send-mothers-day-voucher` — split into two-template, two-send flow, idempotent, log to `mothers_day_voucher_emails`.
- **New React Email-style HTML templates** in the edge function (we don't have transactional infra, so inline HTML stays — but cleanly separated buyer vs recipient).
- **New components**: `MothersDayVoucherCard`, `MothersDayRedeemPage`.
- **Edited**: `SpaBookingModal` (voucher mode), `MothersDayTab` (per-recipient email status + split resend), `Spa.tsx`, `portal/Dashboard.tsx`, `member/Dashboard.tsx`.
- **Stripe**: register the new webhook endpoint URL after deploy and add the signing secret as `STRIPE_MOTHERS_DAY_WEBHOOK_SECRET`.

---

## What you'll see when this ships

- Buyers who bought for themselves: open the app → big gold "Your Mother's Day Voucher" card on the dashboard and the spa page → tap "Book your massage" → no charge, voucher auto-redeems on the appointment.
- Gift recipients: get a real gift-card email addressed to them, from the buyer, with a one-click redeem link. Buyer gets a separate receipt confirming the gift was sent.
- Admin: see per-voucher email status (recipient + buyer), resend either independently, run a reconcile pass on stuck pending sales, and never lose a sale to a closed-tab problem again because the Stripe webhook is now the source of truth.
