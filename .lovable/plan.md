

## Fix: Kids Care Booking Visibility + Visit Deduction + Pass Total

### Problems Found

1. **Booking succeeds but visit isn't deducted**: Line 211 of `useKidsCareBooking.ts` explicitly says `"We don't deduct from pass here"`. The booking is created in `kids_care_bookings` but `classes_remaining` on the pass is never decremented. This means the pass never runs out.

2. **Booking doesn't show in "upcoming"**: The booking is inserted successfully, but the `useMyKidsCareBookings` hook uses `(supabase.from as any)("kids_care_bookings")` with type casting. If the insert silently fails or the query cache isn't properly refreshed, the booking won't appear. Additionally, the RLS UPDATE policy only allows updates when `status IN ('confirmed', 'pending')` — this is fine, but we should verify the insert is actually persisting.

3. **Pass should be 16 visits/month, not 4**: The Stripe webhook (line 1643) and initial pass creation both set `classes_total: 4` and `classes_remaining: 4`. You want 4 visits/week × 4 weeks = **16 visits per month**.

### Solution

#### 1. Deduct visit at booking time (not check-in)
- After the booking insert succeeds, decrement `classes_remaining` on the pass by 1
- If cancellation happens (with the 2-hour policy), restore the visit back to the pass
- This mirrors how class bookings work with `create_atomic_class_booking`

#### 2. Fix pass totals: 4 → 16
- Update the Stripe webhook renewal logic to set `classes_total: 16` and `classes_remaining: 16`
- Update the initial pass creation in the checkout success handler to use 16 as well

#### 3. Ensure bookings appear immediately
- After successful mutation, invalidate both `kids-care-bookings` and `kids-care-passes` query keys (already done, but we'll ensure the deduction triggers a proper refresh)

### Files to modify
- `src/hooks/useKidsCareBooking.ts` — Add pass deduction after booking insert; restore on cancellation
- `supabase/functions/stripe-webhook/index.ts` — Change `classes_total`/`classes_remaining` from 4 → 16 in renewal logic
- `supabase/functions/stripe-payment/index.ts` — Change initial pass creation from 4 → 16 (if applicable in checkout.session.completed handler)

### Technical Details

**Booking deduction** (in `useBookKidsCare`):
```typescript
// After successful insert, deduct from pass
await supabase
  .from("class_passes")
  .update({ classes_remaining: passes.classes_remaining - 1 })
  .eq("id", params.passId);
```

**Cancellation refund** (in `useCancelKidsCareBooking`):
```typescript
// After successful cancel, restore visit to pass
if (booking.pass_id) {
  const { data: pass } = await supabase
    .from("class_passes")
    .select("classes_remaining")
    .eq("id", booking.pass_id)
    .single();
  if (pass) {
    await supabase
      .from("class_passes")
      .update({ classes_remaining: pass.classes_remaining + 1, status: 'active' })
      .eq("id", booking.pass_id);
  }
}
```

**Webhook fix** (classes_total and classes_remaining):
```typescript
// Change from 4 to 16 in both renewal and creation paths
classes_total: 16,
classes_remaining: 16,
```

