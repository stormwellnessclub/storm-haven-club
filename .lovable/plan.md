

# Fix Kids Care: Pass-Per-Child Enforcement, Jessica's Missing Stripe Charge, Charge Parent Button

## Problems Found

### 1. Jessica's pass was never charged in Stripe
Jessica Seagull's pass (`price_paid: $77.55`, created `2026-03-22`) exists in the database but you don't see it in Stripe. This means it was either:
- Created via the "Grant Pass" dialog (free grant) with a price_paid value set manually
- Created by the old code path before auto-provisioning was fixed
- Created via a "manual/cash" charge in ChargeItemSelector (which records the amount but doesn't go through Stripe)

**Action needed**: This is a data/billing issue. You need to charge Jessica through her member profile using ChargeItemSelector → Kids Care Monthly Pass. Her current pass in the system should be deleted or marked as the one created after the actual charge.

### 2. Maryam has 2 kids but only 1 pass — system allows sharing
Maryam Hachem has Hassan and Madina both booked under the same single pass (ID: `8de952c4`). The system deducted 2 sessions (16→14) from one pass for two different children. The business rule should be: **each child needs their own pass**. But the current booking flow just lets you pick any pass regardless of which child you're booking for.

### 3. "Charge Parent" button still missing from Childcare page
The approved plan to add a "Charge Parent" button on the "No pass linked" warning was never implemented.

## Plan

### 1. Enforce one pass per child
- In `useBookKidsCare` (member flow): Before booking, check if the selected pass already has bookings for a **different child**. If so, block with error "This pass is already assigned to [other child name]. Each child needs their own pass."
- In `KidsCareBookingModal.tsx`: Filter the pass dropdown to only show passes that are either unused OR already used by the same child being booked.
- In `KidsCareBookForParent.tsx` (admin flow): Same filtering logic on the pass selector.
- In `admin_create_kids_care_booking` RPC: Add server-side validation — check `kids_care_bookings` for non-cancelled bookings using the same pass but a different child name. Reject if found.

### 2. Add "Charge Parent" button to Childcare page
- In `src/pages/admin/Childcare.tsx`, in the "No pass linked" warning block, add a "Charge Parent" button.
- If `booking.member` exists → navigate to `/admin/members/${booking.member.id}`
- If no member → navigate to `/admin/non-members/${booking.user_id}`

### 3. Migration: Update RPC with per-child pass validation
- Update `admin_create_kids_care_booking` to check that the pass isn't already used by a different child.

## Files to change
- `src/hooks/useKidsCareBooking.ts` — add per-child pass validation in `useBookKidsCare`
- `src/components/booking/KidsCareBookingModal.tsx` — filter pass dropdown by selected child
- `src/components/admin/KidsCareBookForParent.tsx` — filter pass dropdown by selected child
- `src/pages/admin/Childcare.tsx` — add "Charge Parent" navigation button
- Migration: update `admin_create_kids_care_booking` RPC with child-pass validation

## Immediate data fix needed
- Maryam needs a second pass for her second child. Staff should charge her for another Kids Care Monthly Pass, then reassign one child's bookings to the new pass.
- Jessica needs to be actually charged through Stripe via her member profile.

