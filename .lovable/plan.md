

# Enable Direct Merch Purchases from Member Accounts

## The Problem
The Storm Shop (`/shop`, linked from the member sidebar) currently only supports **preorders** — it records an order but never charges anyone. Members with cards on file should be able to buy and pay immediately, just like they can in the Cafe.

## What Already Exists
- The Cafe page (`src/pages/Cafe.tsx`) has a complete payment flow: it lists saved payment methods via `stripe-payment` → `list_payment_methods`, then charges via `charge_saved_card`. This is the exact pattern to replicate.
- The `charge_saved_card` action in the `stripe-payment` edge function supports both `memberId` and `stripeCustomerId` flows.
- The `merch_orders` table already stores orders with `payment_method`, `stripe_payment_intent_id`, and `status` fields.

## Plan

### 1. Add payment flow to the Storm Shop page
Modify `src/pages/Merch.tsx` to support two checkout modes:

- **Logged-in members with card on file**: Show a payment dialog (similar to Cafe) that lists their saved payment methods, lets them pick one, and charges via `charge_saved_card`. The order is created with `status: 'paid'` and the Stripe payment intent ID.
- **Guest / no card**: Keep existing preorder flow as a fallback.

Specific changes:
- Add state for payment method selection, saved cards list, and processing status
- On checkout, fetch saved payment methods via `stripe-payment` → `list_payment_methods`
- If member has cards, show card selection and "Pay Now" button that calls `charge_saved_card` with the order total in cents
- On successful charge, create the `merch_order` with `status: 'paid'` and `stripe_payment_intent_id`
- Add MI sales tax (6%) to the total, matching Cafe behavior
- Support a multi-item cart instead of single-product checkout (add to cart → review cart → pay)

### 2. Add a cart system to the shop
Currently the shop only lets you buy one item at a time. Convert to a cart-based flow:
- Add a cart state (array of items with product, size, color, quantity)
- Show a persistent cart summary/badge
- Allow adding multiple products before checking out
- Cart review step before payment

### Files to modify
- **`src/pages/Merch.tsx`** — Add cart system, payment method selection dialog, `charge_saved_card` integration, tax calculation, and paid order creation

No database or edge function changes needed — all infrastructure already exists.

