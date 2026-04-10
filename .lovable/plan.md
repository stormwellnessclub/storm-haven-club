

# Fix Guest Pass Sale to Charge Card on File

## Problem
When selling a guest pass package to Catherine Leaym (or any non-member with a card on file), the system redirects to Stripe's hosted checkout page (which asks for link verification / PIN). It should charge the saved card directly — she has a Visa •••• 3996 on file.

## Root Cause
`NonMemberGuestPassSaleCard.tsx` always uses the `create_guest_pass_checkout` action, which creates a Stripe Checkout session and redirects. It never checks whether the non-member already has a card on file.

## Plan

### Step 1: Update NonMemberGuestPassSaleCard to support card-on-file charging
Modify `src/components/admin/NonMemberGuestPassSaleCard.tsx`:
- Accept `stripeCustomerId` and `cardLast4`/`cardBrand` as props
- When a card is on file, show the card info (e.g., "Visa •••• 3996") and a "Charge Card on File" button
- When clicked, call `charge_saved_card` with the `stripeCustomerId` and amount instead of redirecting to checkout
- After successful charge, create the guest pass records in the database (same as the checkout webhook would)
- Keep the existing Stripe Checkout redirect as a fallback for non-members without a card on file

### Step 2: Create guest pass records after direct charge
After a successful `charge_saved_card` call, insert the guest pass records into the `guest_passes` table directly from the frontend (matching what the webhook would do). This includes:
- Creating `quantity` guest pass records
- Setting `price_paid`, `guest_name`, `guest_email`, `expires_at`, `status`, `purchased_at`
- Linking to the payment intent ID from the charge result

### Step 3: Pass card-on-file data from the parent component
Update `src/components/admin/NonMemberDetailSheet.tsx` (or wherever `NonMemberGuestPassSaleCard` is rendered) to pass `stripeCustomerId`, `cardBrand`, and `cardLast4` as props.

## Technical Details
- **Files modified**: `src/components/admin/NonMemberGuestPassSaleCard.tsx`, parent component that renders it
- **Edge function**: Uses existing `charge_saved_card` action — no backend changes needed
- **Database**: Inserts into `guest_passes` table after charge succeeds
- **No migrations needed**

