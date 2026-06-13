## Add Cafe ordering to member & non-member portals

Surface the existing café ordering experience inside both portals as a dedicated tab, with in-page checkout (no Stripe redirect, no leaving the portal) for both members and non-members. Non-members must have a card on file before they can pay.

### New routes
- `/member/cafe` — member-facing café order page (uses `MemberLayout`)
- `/portal/cafe` — non-member portal café order page (uses `PortalLayout`)

Both add a new top-level nav entry "Cafe Order" (icon: `Coffee`) — in `MemberSidebar`, `MemberBottomNav` (replace/append), `PortalSidebar`, and `PortalBottomNav`.

### Shared component
Create `src/components/cafe/CafeOrderFlow.tsx` extracted from the public `/cafe` page so the menu, cart, add-on dialog, totals (subtotal + 6% MI tax + processing fee), and SMS opt-in nudge are reused. It accepts a `mode: "member" | "nonmember"` prop that drives the checkout dialog and card-list lookup.

The public `/cafe` page is refactored to render `<CafeOrderFlow mode="member" />` when the user is a member, `mode="nonmember"` when not — so behavior stays consistent everywhere.

### Checkout dialog behavior (in-page, no redirect)

**Member mode (`/member/cafe` and member-signed-in `/cafe`)**
- Loads saved cards via existing `list_payment_methods` (members) action — already works today.
- Payment method select: "Saved Card" (default) or "Charge to Member Account".
- "Add a new card" button → opens an embedded Stripe Elements `<PaymentElement>` inside the dialog (no redirect), uses `create_setup_intent` to attach a new card to the member's Stripe customer, then re-lists cards and selects the new one.
- Charges via existing `charge_saved_card` action.

**Non-member mode (`/portal/cafe` and non-member-signed-in `/cafe`)**
- Loads saved cards via existing `list_nonmember_payment_methods` action.
- If **no card on file**: dialog locks the Pay button and shows an inline Stripe Elements `<PaymentElement>` block titled "Add a card to place this order". Uses existing `create_nonmember_setup_intent`. After SetupIntent succeeds we silently re-list cards, auto-select, and enable Pay — all inside the dialog. No leaving the page, no second click required.
- If card on file: select-a-card UI identical to member mode.
- "Charge to Member Account" option is hidden.

### Backend — one new edge function action
Add `charge_nonmember_saved_card` to `supabase/functions/stripe-payment/index.ts`, modeled on the existing `charge_saved_card`:
- Looks up `non_member_profiles.stripe_customer_id` for the authenticated user.
- Confirms a `PaymentIntent` off-session against the saved `paymentMethodId`.
- Accepts the same `amount`, `description`, `processingFee`, `taxAmount`, `subtotal`, `chargeType: "pos"` shape — so cents already include tax + fee, no double charging.
- Returns `{ success, paymentIntentId, error? }` using the project's HTTP-200-on-decline convention.

### Order record — capture non-member identity
`cafe_orders` already has `user_id` and `member_id`. For non-member orders we set:
- `user_id` = the auth user id
- `member_id` = null

To surface the customer name in admin without schema changes:
- `useCreateCafeOrder` is extended to also write `customer_name` and `customer_phone` into the `order_items` JSON payload root (already free-form jsonb) when no `member_id` is present. **Optional:** if you'd rather store them in real columns, add a tiny migration (`customer_name text`, `customer_phone text`) — call out which you'd prefer.
- `useAdminCafeOrders` already shows the member name when `member_id` is set; we extend it to fall back to joining `non_member_profiles` on `user_id` when `member_id` is null, so non-member orders display the name in the existing Cafe POS / Kiosk Orders list.

### Existing `/cafe` page — fixed at the same time
Today the public `/cafe` payment dialog only works for members (the lookup hits `members` and falls back to `member_portal` link if no card). The refactor above makes non-members able to order from the public `/cafe` page too, and removes the dead "no saved payment methods → go to member portal" copy in favor of the inline add-card UX.

### Out of scope
- Cafe credit redemption inside the portal flow (members on POS already get it via in-club POS; portal orders pay full price). Easy follow-up if you want it surfaced.
- A "My Cafe Orders" history tab — say the word and I'll add it (the `useMyCafeOrders` hook already exists).
- No changes to admin Cafe POS UI, kiosk, or order fulfillment.

### Open question
Do you want non-member name/phone stored as **real columns on `cafe_orders`** (tiny migration, cleaner reporting) or **inside the `order_items` jsonb** (no migration)? I'll default to the jsonb approach unless you say otherwise.