

## Fix Guest Invoice + Add Guest Card-on-File

### Problem 1: "Unknown action: create_guest_payment_link"
The Guest Management page calls a `create_guest_payment_link` action on the backend, but that action was never implemented. The function throws "Unknown action" because there is no matching case handler.

### Problem 2: Can't charge guests without a card on file
Guests who use services but didn't save a card during their original pass purchase cannot be charged after the fact. There is no way for staff to add a card for a guest or send them a link to save one.

---

### Changes

**1. Add `create_guest_payment_link` action to the backend function**

Add a new case in `supabase/functions/stripe-payment/index.ts` that creates a Stripe Checkout session in `payment` mode for a guest service. It will:
- Find or create a Stripe customer by the guest's email
- Create a one-time payment checkout session for the specified amount/description
- Include `setup_future_usage: 'off_session'` so the guest's card is saved for future charges
- Return the checkout URL to the admin
- Save the `stripe_customer_id` back to the guest pass record

**2. Add `create_guest_setup_intent` action to the backend function**

A new action that creates a Stripe SetupIntent for a guest (no charge). This allows staff to send a link where the guest can save their card for future billing. It will:
- Find or create a Stripe customer by email
- Create a SetupIntent and return the client secret
- Update the `guest_passes` record with the `stripe_customer_id` and card metadata after setup succeeds

**3. Add "Request Card on File" button in Guest Management UI**

In `src/pages/admin/GuestManagement.tsx`, add a button in the Services tab that generates a Stripe Checkout session in `setup` mode. The link can be copied and sent to the guest. When the guest completes it, their card is saved for future charges.

**4. Update action type in the backend**

Add `create_guest_payment_link` and `create_guest_setup_intent` to the `PaymentRequest` action union type.

---

### Technical details

**Backend -- `create_guest_payment_link` (new case):**
```
- Accepts: guestEmail, guestName, amount (cents), description, serviceId, successUrl, cancelUrl
- Creates or finds Stripe customer by email
- Creates checkout session (mode: "payment", setup_future_usage: "off_session")
- Metadata: type "guest_service_payment", service_id, guest_name
- Updates guest_passes stripe_customer_id if found by email
- Returns { url: session.url }
```

**Backend -- `create_guest_setup_intent` (new case):**
```
- Accepts: guestEmail, guestName, guestPassId (optional)
- Creates or finds Stripe customer
- Creates a Checkout session in "setup" mode
- Returns { url: session.url }
- Saves stripe_customer_id to guest_passes record
```

**Frontend -- GuestManagement.tsx:**
- Add "Save Card" button next to each guest profile that has no card on file
- Calls `create_guest_setup_intent`, opens the returned URL in a new tab
- After returning, staff can refresh to see the card metadata

**Files changed:**
- `supabase/functions/stripe-payment/index.ts` (add 2 new action cases, ~80 lines)
- `src/pages/admin/GuestManagement.tsx` (add "Save Card" button + handler, ~30 lines)
