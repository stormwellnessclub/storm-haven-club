

## Plan: Fix Kids Care Pass Purchase & Add Upcoming Schedule

### Issue 1: "Quantity is required" Stripe Error
The `create_kids_care_checkout` action in the edge function passes `[{ price: kidsCarePrice }]` without `quantity`. The `addRecurringProcessingFeeItems` function preserves the missing quantity on the base item (only the processing fee item gets `quantity: 1`). Stripe requires `quantity` on all `line_items`.

**Fix**: Add `quantity: 1` to the kids care line item on line 691 of `stripe-payment/index.ts`.

### Issue 2: No Schedule / Open Hours on Bookings Page
The Kids Care bookings page only shows bookings — there's no section displaying when Kids Care is open. The `kids_care_hour_slots` table has data (verified earlier), but the page never queries it.

**Fix**: Add an "Upcoming Schedule" section to `KidsCareBookings.tsx` that fetches the next 7 days of slots from `kids_care_hour_slots` and displays them.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Add `quantity: 1` to kids care line item (line 691) |
| `src/pages/member/KidsCareBookings.tsx` | Add "Upcoming Hours" section querying `kids_care_hour_slots` for next 7 days |
| `src/hooks/useKidsCareHours.ts` | Add `useUpcomingKidsCareSlots()` hook — single query for next 7 days of slots |

