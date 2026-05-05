## Goal
Enforce: **Fundraiser class sessions cannot be booked with class credits or class passes — every attendee must pay $40 at checkout** so 100% can be donated.

## Backwards-compatibility guarantee (non-fundraiser classes)
This is the explicit safety check the user asked for. Every change is gated on `is_fundraiser = true`, so non-fundraiser sessions follow the existing flow byte-for-byte:

- **`create_atomic_class_booking` RPC**: the fundraiser block is a single early-return inside `IF _session_record.is_fundraiser THEN …`. All other branches (credits, pass, capacity, blocked-email, duplicate booking, enrollment trigger) are kept identical to the current production version. Non-fundraiser sessions never enter the new branch.
- **`is_fundraiser` column**: already exists with `NOT NULL DEFAULT false`, so every existing row and every future schedule-generated session is `false`. No migration of historical data needed.
- **Stripe edge function**: a brand-new `case 'create_fundraiser_class_checkout'` is added. Existing cases (`create_class_pass_checkout`, credits purchase, etc.) are untouched.
- **Webhook**: a new `metadata.type === 'fundraiser_class_booking'` branch is added alongside the others; existing branches are untouched.
- **`BookingModal.tsx`**: every fundraiser-specific UI swap is wrapped in `if (session.is_fundraiser) { … } else { /* existing markup */ }`. The default render path for normal classes is preserved exactly.
- **`ClassCard.tsx`**: button label change is `session.is_fundraiser ? "Donate & Reserve" : "Book"`. Same handler.
- **`useBooking.ts` pre-flight guard**: only fires when the loaded session has `is_fundraiser = true`. Normal sessions skip the guard and go straight to the RPC as today.
- **Waitlist, cancellations, reminders, schedule generation, attendance, reviews**: untouched. Fundraiser sessions are one-offs (`schedule_id = NULL`) and the May 12 records are already in place, so weekly reconciliation will not delete them and won't create duplicates.

## Remaining work

### 1. Migration — fundraiser gate + fulfillment RPC
Replace `create_atomic_class_booking` with a copy of the current function plus one new block:
```
IF _session_record.is_fundraiser THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'This is a fundraiser class. Credits and class passes cannot be used — please complete checkout to pay the donation amount in full.'
  );
END IF;
```
All other logic (BLOCKED CHECK, payment validation, capacity check, duplicate-booking check, member_credits / class_passes decrement, INSERT, enrollment trigger) is preserved verbatim.

Add `create_fundraiser_class_booking(_session_id, _user_id, _amount_cents)` (SECURITY DEFINER) used only by the Stripe webhook to insert a confirmed booking with `payment_method = 'cash'` and `amount_paid = amount/100`. Idempotent (returns existing booking_id if already confirmed).

### 2. Edge function `stripe-payment` — new action
`create_fundraiser_class_checkout`: validates `is_fundraiser`, not cancelled, not full, no existing booking. Creates Stripe Checkout `mode: 'payment'` with `override_price_cents` (default 4000) + processing fee. Metadata `type: 'fundraiser_class_booking'`, `class_session_id`, `user_id`, `amount_cents`, `beneficiary` on both checkout and payment_intent_data. Product name: `"{Beneficiary} Fundraiser — {Class Name}"`. Returns `{ url }` for new-tab redirect.

### 3. Edge function `stripe-webhook` — new branch
In `checkout.session.completed`, add `else if (metadata.type === 'fundraiser_class_booking')` that calls `create_fundraiser_class_booking` RPC. Logged + idempotent.

### 4. UI — `BookingModal.tsx`
Wrap fundraiser branch around the payment selection / book button:
- Hide credits/pass radios.
- Show "Donation Checkout" panel: $40, beneficiary, "100% of proceeds donated…".
- Replace primary button with **"Donate $40 & Reserve Spot"** → `supabase.functions.invoke('stripe-payment', { body: { action: 'create_fundraiser_class_checkout', sessionId, successUrl, cancelUrl } })` then `window.open(url, '_blank')`.
- Liability waiver still required.
- Skip the "purchase a pass" empty-state for fundraiser sessions.

### 5. UI — `ClassCard.tsx`
Button label conditional: `session.is_fundraiser ? "Donate & Reserve" : "Book"`. Same click handler opens BookingModal.

### 6. `useBooking.ts` — defense-in-depth pre-flight
Before calling the RPC, fetch `is_fundraiser` for the session and throw a friendly error pointing to the donation checkout if true. This protects against a stale tab and guarantees no credit/pass is ever consumed for a fundraiser session even if the UI didn't switch over.

## Files
- New migration (replaces `create_atomic_class_booking`, adds `create_fundraiser_class_booking`).
- `supabase/functions/stripe-payment/index.ts` — new case.
- `supabase/functions/stripe-webhook/index.ts` — new metadata branch.
- `src/components/booking/BookingModal.tsx` — fundraiser branch.
- `src/components/booking/ClassCard.tsx` — donate label.
- `src/hooks/useBooking.ts` — pre-flight fundraiser guard.

## Post-implementation verification
- Manually book a normal Pilates/Cycling class with credits — should succeed exactly as today.
- Manually book a normal class with a pass — should succeed and decrement.
- Try to book the May 12 fundraiser with credits — RPC returns the friendly fundraiser error, nothing decremented.
- Complete a $40 fundraiser checkout — webhook records confirmed booking, enrollment increments via existing trigger.
- Cancel a fundraiser booking — existing `cancel_class_booking` works (no credit refund since payment_method = 'cash').
