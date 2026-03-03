

# Fix POS Customer Search to Include Non-Members and Guests

## The Problem

Both POS terminals (Cafe POS and Front Desk POS) only search the `members` table when looking up a customer. Non-members who have cards on file (via `non_member_profiles.stripe_customer_id`) and guests with saved cards are completely invisible to staff. This means staff cannot charge their saved cards for cafe purchases or other POS transactions.

Additionally, the Cafe POS (`CafePOS.tsx`) has a member search input that **does nothing** -- there is no `handleMemberSelect` function wired up. Only the Front Desk POS has working search logic, and even that only queries `members`.

## Plan

### 1. Add unified customer search to both POS pages

Update `FrontDeskPOS.tsx` `handleMemberSelect` (and create one for `CafePOS.tsx`) to search across three sources:

1. **Members** -- `members` table (existing, searching `first_name`, `last_name`, `email` where `status = 'active'`)
2. **Non-members** -- `non_member_profiles` table (searching `first_name`, `last_name`, `email` where `stripe_customer_id` is not null)
3. **Guests** -- `guest_passes` table (searching `guest_name`, `guest_email` where they have a linked user with Stripe)

Present results as a dropdown list with type badges (Member, Non-Member, Guest) so staff can pick the right person.

### 2. Extract shared customer search into a reusable component

Create `src/components/admin/POSCustomerSearch.tsx` that:
- Accepts a search string and returns matching customers from all three tables
- Shows a dropdown of results with name, email, type badge, and card-on-file indicator
- On selection, passes back `{ name, cardOnFile, stripeCustomerId, type }` to the parent POS

### 3. Wire card charging for non-members

The `charge_saved_card` action in the `stripe-payment` edge function already accepts a `customerId` parameter -- it doesn't care if the customer is a member or non-member. So the charging logic in `FrontDeskPOS.tsx` will work as-is once we pass the correct `stripeCustomerId` from the non-member profile.

### 4. Update CafePOS to actually process card payments

`CafePOS.tsx` currently calls `createOrder.mutateAsync` but never charges a card via Stripe. Copy the Stripe charging logic from `FrontDeskPOS.tsx` so card-on-file payments actually go through.

## Files to Modify

- **`src/components/admin/POSCustomerSearch.tsx`** (New) -- Shared search component querying members + non_member_profiles + guest profiles, with dropdown results
- **`src/components/admin/CafePOSCart.tsx`** -- Replace the simple search input with the new `POSCustomerSearch` component
- **`src/pages/admin/CafePOS.tsx`** -- Add Stripe card charging logic (like FrontDeskPOS), wire up customer selection callback
- **`src/pages/admin/FrontDeskPOS.tsx`** -- Replace inline member search with the shared `POSCustomerSearch`, expand to include non-members

## No database changes required

The `non_member_profiles` table already has `stripe_customer_id`, `card_brand`, and `card_last4` columns. The `charge_saved_card` edge function is customer-type agnostic.

