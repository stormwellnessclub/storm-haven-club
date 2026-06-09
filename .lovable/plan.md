
## What I found

### Bug 1 — Rayanne wasn't actually charged

In `src/pages/admin/ClassRoster.tsx`, the **"Promote from waitlist"** flow (lines 552–562) inserts a booking with `payment_method: "walk_in"` and `amount_paid: 2500`… and **never calls Stripe**. No `manual_charges` row, no payment intent. The toast says "Promoted from waitlist" so it looks successful, but no money moves.

Verified in the DB for Rayanne Haidar:
- Booking `96b67ac9…` (Full Body Strength Sat) was created at 03:14 with `amount_paid 25.00`, then cancelled at 03:18 — no matching `manual_charges` row, no Stripe PI. So you were right: no charge happened.

The regular **"Add to class"** drop-in path (lines 688–721) *does* call Stripe, but when it fails it only shows an `info` toast "collect at desk" and leaves the booking row sitting there with `amount_paid` looking paid. Same misleading signal.

### Bug 2 — No confirmation emails on admin actions

- `promoteMutation` (waitlist → confirmed) sends **no email or SMS** to the member.
- `addMutation` (admin manually adds member to class) also sends nothing.
- Templates `booking_confirmation`, `waitlist_claim_confirmation`, and the SMS equivalents already exist in `send-email` / `send-sms`; they're just not invoked from these admin flows.

The automated paths (member self-books, waitlist auto-notify) already wire emails correctly via `notify-waitlist` and `useBooking` / `useWaitlist`. The gap is admin-driven actions only.

---

## Plan

### 1. Fix promote-from-waitlist "drop-in" to actually charge the card

In `ClassRoster.tsx` `promoteMutation` (`method === "dropin"` branch):
- Call `supabase.functions.invoke("stripe-payment", { body: { action: "charge_saved_card", memberId, amount, description: "Drop-in: <class> on <date> (waitlist promotion)" } })` **before** inserting the booking.
- If `success: false` or no card on file → throw with the Stripe decline message → mutation `onError` shows a clear red toast ("Card declined — $X NOT collected: <reason>"). Do not create the booking row.
- If success → insert booking as today, then mark waitlist `claimed`.
- Show success toast with explicit amount: `"Charged $25.00 to <member name>'s card and promoted from waitlist"`.

### 2. Fix add-to-class drop-in (same file, `addMutation` `dropin` branch)

Restructure to **charge first, then insert booking** so the two states can't disagree:
- Charge via `stripe-payment` first.
- On decline → red error toast "Card declined — $X NOT collected: <reason>. Booking NOT created." Return.
- On success → insert booking with `amount_paid`. Toast: `"Charged $X to <member>'s card — added to class"`.
- Keep the existing "no member / non-member walk-in" path: insert with `amount_paid` and the "collect at desk" info toast — that one is legitimately unpaid.

### 3. Send confirmation email + SMS on admin promote-from-waitlist

After the booking insert succeeds in `promoteMutation`, fire (best-effort, parallel `Promise.allSettled`, non-fatal):
- `supabase.functions.invoke("send-email", { body: { type: "waitlist_claim_confirmation", to, data: { className, date, time, paymentMethod } } })`
- `supabase.functions.invoke("send-sms", { body: { templateKey: "waitlist-claimed", … } })` if member has `sms_opt_in` and phone.

Look up the member's email/phone the same way `useWaitlist.ts` does (members → profiles → non_member_profiles fallback). Use an `idempotencyKey` of `waitlist-promote-<bookingId>`.

### 4. Send confirmation email + SMS on admin add-to-class

After `addMutation` succeeds, send `booking_confirmation` email + `booking-confirmed` SMS the same way. Idempotency key `admin-add-<bookingId>`.

### 5. Verify SMS templates exist

Confirm `waitlist-claimed` and `booking-confirmed` keys exist in `src/lib/smsTemplates.ts` and `send-sms/index.ts`. Add them if missing (short copy mirroring the existing `waitlist-joined` style — under 160 chars, brand prefix, STOP/HELP not required on confirmations).

---

## Technical notes

- No DB schema changes.
- All work is in `src/pages/admin/ClassRoster.tsx` plus possibly a small append to `src/lib/smsTemplates.ts` and `supabase/functions/send-sms/index.ts`.
- `stripe-payment / charge_saved_card` already records `manual_charges`, applies the standard processing-fee gross-up, and returns HTTP 200 with `success: false` on decline (per the project convention) — so we just need to read `data.success` and surface `data.error` / `data.decline_code`.
- Emails/SMS use existing edge functions and templates — no new infra.

## Out of scope (parking lot)

- Twilio A2P campaign resubmission (already on your todo list).
- Reconciling the existing orphaned `walk_in` bookings with `amount_paid` set but no `manual_charges` row (you may want a one-time admin report; flag if you want it built).
