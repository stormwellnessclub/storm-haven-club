

# Admin Guest Pass Bulk Sale with Custom Pricing

## What
Add quantity selector and custom price override (discount) to the Guest Pass Quick Sale form on `/admin/guest-passes`. Only visible to admin/super_admin roles. Works for any guest (member or non-member).

## Changes

### 1. Frontend — `src/pages/admin/GuestPasses.tsx`
- Add `quantity` state (default 1, min 1, max 10) with a number input or +/- stepper
- Add `customPrice` state (nullable number) and a toggle/checkbox "Apply discount" — when enabled, show an input to override the per-pass price (default $60)
- Both fields only render when `isAdmin()` returns true (from `useUserRoles`)
- Display calculated total: `quantity × (customPrice || 60)` + processing fee
- Pass `quantity` and `customPrice` to the edge function in `handleCreatePass`

### 2. Edge Function — `supabase/functions/stripe-payment/index.ts`
In the `create_guest_pass_checkout` case:
- Accept new fields: `quantity` (number, default 1) and `customPrice` (number in dollars, optional)
- If `customPrice` is provided, create an ad-hoc Stripe Price (using `stripe.prices.create` with `unit_amount` in cents, `currency: 'usd'`, linked to the guest pass product) instead of using the fixed `STRIPE_PRODUCTS.guestPass` price
- Set `quantity` on the line item instead of hardcoded `1`
- Add `quantity` and `custom_price` to the checkout session metadata so the webhook can create the correct number of guest_passes records

### 3. Webhook handling — ensure multiple passes created
- Check the existing webhook handler that processes guest pass checkout completions
- Ensure it reads `metadata.quantity` and creates that many `guest_passes` rows (currently it creates 1)
- Each pass gets the same guest info but its own unique ID

### 4. Role gating
- Import and use `useUserRoles` hook (already imported in the file)
- Show quantity + discount fields only when `isAdmin()` is true
- The edge function doesn't need role checks since Stripe Checkout handles payment — the discount is just a different price

## Result
Admins see quantity and discount controls in Quick Sale. They can sell e.g. 3 guest passes at $50 each. Non-admin staff see the standard single-pass $60 form. The correct number of passes is created in the database after payment.

