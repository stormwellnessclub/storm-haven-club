

# Fix Guest Pass Admin Controls & Profile Visibility

## Problems
1. **No expiration date control** — The Quick Sale form has no field to set a custom expiration date. The webhook hardcodes `expiresAt` to 1 day from purchase.
2. **Price/discount field exists but needs clearer UX** — The discount toggle works but the custom price isn't passed through to the expiration date metadata.
3. **Guest passes don't show on member/non-member profiles** — The `guest_passes` table stores `user_id` as the *admin who sold* the pass, not the guest. So the MemberDetail query (`guest_passes.user_id = member.user_id`) only finds passes where that member was the seller. Non-member profiles have no guest pass section at all.

## Changes

### 1. Add Expiration Date Field to Quick Sale (`src/pages/admin/GuestPasses.tsx`)
- Add `expirationDate` state (default: 1 day from visit date) inside the admin-only section
- Add a date picker labeled "Expiration Date" next to quantity and discount
- Pass `expirationDate` to the edge function as `expiresAt` metadata

### 2. Pass Expiration Through Edge Function (`supabase/functions/stripe-payment/index.ts`)
- Accept `expiresAt` in the `create_guest_pass_checkout` metadata
- Add it to the Stripe session metadata as `expires_at`

### 3. Use Custom Expiration in Webhook (`supabase/functions/stripe-webhook/index.ts`)
- In the `guest_pass` handler (~line 622), check for `metadata.expires_at`
- If present, use it instead of the hardcoded 1-day expiration
- Fallback to 1 day if not provided (preserves behavior for public/non-admin sales)

### 4. Link Guest Passes to Guest Profiles
The `guest_passes` table has `guest_email` and `guest_name` fields. To show passes on a person's profile:

**MemberDetail.tsx** (~line 387): Change the query to also match by email:
```
.or(`user_id.eq.${member.user_id},guest_email.ilike.${member.email}`)
```

**NonMemberDetail.tsx**: Add a guest passes query matching by `guest_email` (using the non-member's email) and display a "Guest Passes" section in the profile tabs.

### 5. Summary of the price display
The admin discount controls (quantity + custom price) already work and flow through Stripe correctly. The only missing piece is the expiration date — with that added, admins will have full control over quantity, price, and expiration.

## Result
- Admins see quantity, discount, and expiration date controls on Quick Sale
- Guest passes appear on the correct person's profile (member or non-member) matched by email
- Non-admin staff see the standard single-pass $60 form with no overrides

