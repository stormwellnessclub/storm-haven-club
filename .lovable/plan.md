## Corrected understanding

You are right: **admin holds should not be released to customers.** If you hold 4 seats, those 4 seats must stay blocked until admin converts or releases them.

The 12pm fundraiser currently has 8 total capacity with 4 admin holds, so it should still have **4 public donation spots** available. The issue is that the app is using `current_enrollment` as if every occupied seat is a real customer seat. Since holds count in `current_enrollment`, the public UI thinks the class is full even though only the non-held public spots should be counted for fundraiser checkout.

There is also a frontend bug in `BookingModal.tsx`: `useState` for fundraiser checkout is declared after `if (!session) return null`, which can cause a React hook-order crash when opening/closing the modal. That matches the “kicks me out of the session” behavior.

## Plan

### 1. Add a safe backend availability RPC for fundraiser checkout
Create a database function such as `get_fundraiser_public_availability(session_id)` that returns:

- `max_capacity`
- `confirmed_total`
- `admin_holds`
- `confirmed_non_hold`
- `public_spots_left = max_capacity - admin_holds - confirmed_non_hold`

Rules:

- Admin holds remain reserved and unavailable to customers.
- Customers may only book if `public_spots_left > 0`.
- Normal class credit/pass booking remains unchanged and still treats holds as occupying capacity.

For the 12pm class: `8 capacity - 4 holds - 0 real fundraiser bookings = 4 public spots left`.

### 2. Fix fundraiser checkout creation in `stripe-payment`
Update `create_fundraiser_class_checkout` so it checks public fundraiser availability using non-hold seats instead of `current_enrollment >= max_capacity`.

Important behavior:

- It will **not** consume or convert admin holds.
- It allows checkout only for the non-held capacity.
- It still blocks true sellout when `admin holds + real bookings >= capacity`.
- It still blocks duplicate bookings for the same logged-in account.

### 3. Fix fundraiser webhook fulfillment
Update the `create_fundraiser_class_booking` database function used by the webhook so successful fundraiser payments create a real booking only when there is public capacity excluding admin holds.

Because the insert trigger increments `current_enrollment`, this preserves correct counts:

- Admin holds stay in the roster as holds.
- Paid customers get new real bookings.
- Once real bookings fill the unheld seats, future checkout is blocked.

### 4. Fix the booking modal crash
Move fundraiser checkout state (`isFundraiserCheckingOut`) above the early `if (!session) return null` in `BookingModal.tsx`.

This prevents React from changing hook order when the modal opens/closes.

### 5. Update public fundraiser UI to use real public availability
For fundraiser classes on schedule cards and the booking modal:

- Show capacity as public spots left excluding admin holds.
- Keep the CTA as **Donate & Reserve** while public spots remain.
- Show full/waitlist only when public spots are truly gone.

Implementation approach:

- Query confirmed admin hold counts for the visible sessions on `/schedule`.
- Add `admin_hold_count`/derived public spot count to the session data passed into `BookingModal` and `ClassDetailsSheet`.
- For non-fundraiser classes, keep the current behavior exactly as-is.

### 6. Update class card behavior used elsewhere
In `ClassCard.tsx`, calculate fundraiser spots as:

`max_capacity - admin_holds - non_hold_confirmed_bookings`

If the component does not have hold counts available, keep the button routing to the modal and let the backend be the source of truth, but avoid sending fundraiser customers into the credits/pass waitlist path.

## Files to update

- `supabase/migrations/...fundraiser_public_availability.sql`
- `supabase/functions/stripe-payment/index.ts`
- `supabase/functions/stripe-webhook/index.ts` if needed, depending on whether the database RPC alone can enforce fulfillment
- `src/components/booking/BookingModal.tsx`
- `src/components/booking/ClassCard.tsx`
- `src/components/booking/ClassDetailsSheet.tsx`
- `src/pages/Schedule.tsx`
- `src/hooks/useClassSessions.ts` if the shared class session type needs an `admin_hold_count` field

## Expected result

- The 12pm fundraiser with 4 unheld seats will allow 4 customers to donate and reserve.
- The 4 admin holds stay protected and cannot be taken by customers.
- The 11am fundraiser with all seats held/admin-filled will correctly show no public booking spots unless admin releases holds.
- Opening the fundraiser booking modal will no longer crash or kick the user out.