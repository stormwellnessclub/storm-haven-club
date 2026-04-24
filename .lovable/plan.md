

## Goal
Let admins look up and book non-members (and walk-in guests with a card on file) into spa appointments — and charge them the same way members are charged.

## What's broken today
In `src/components/admin/spa/AdminSpaBookingModal.tsx` the "Member" search only queries the `members` table. Non-members in `non_member_profiles` (and existing guest customers in `guest_passes`) never show up, so staff can't select them and can't book them.

The downstream pieces already support non-members:
- `spa_appointments.member_id` is nullable; `user_id` can be set instead
- `useAdminSpaAppointments` already joins to a member, but `SpaCompletionDialog` needs the same card-on-file fields for non-members
- `stripe-payment` edge function `charge_saved_card` already accepts `stripeCustomerId` directly (no member required)

## Plan

### 1. Replace the member-only search with a unified customer search
In `AdminSpaBookingModal.tsx`, replace the current `member-search-spa` query with a parallel search across:
- `members` (active/frozen) → returns `member_id` + `user_id` + card fields
- `non_member_profiles` → returns `user_id` + `stripe_customer_id` + card fields + `waiver_signed`
- `guest_passes` (with `stripe_customer_id`) → walk-in guests who already have a card on file

Each result row in the dropdown shows:
- Name + email
- Type badge: Member / Non-Member / Guest
- Small "card on file" indicator when present

Selected customer state changes from `selectedMemberId / selectedMemberName` to a single `selectedCustomer` object holding:
- `type: "member" | "non_member" | "guest"`
- `memberId` (nullable)
- `userId` (nullable)
- `stripeCustomerId` (nullable)
- `name`, `email`
- `waiverSigned`
- `cardBrand`, `cardLast4`

### 2. Keep waiver enforcement working for both member types
The existing `checkMemberWaiver` already checks both `profiles.waiver_signed` and `non_member_profiles.waiver_signed` — keep that, but drive it off `selectedCustomer.userId`. The "Liability Waiver Not Signed" alert and the disabled Book button stay the same.

For walk-in guests selected from `guest_passes` with no `user_id`, treat them as "no portal account → waiver must be signed in person before booking massage." Show a clear inline notice and block massage bookings; allow other categories.

### 3. Save the appointment with the right identifier
In the `bookMutation`, when inserting into `spa_appointments`:
- If member → set `member_id` and `user_id` (current behavior)
- If non-member → set `member_id = null`, set `user_id = selectedCustomer.userId`
- If guest with no user account → set both to null and store name/email in `staff_notes` header line so the admin grid still shows who it's for

No schema change required.

### 4. Surface non-member info in the admin appointments list and completion dialog
- Update `useAdminSpaAppointments` so each appointment also resolves a non-member fallback when `member` is null. Add a parallel fetch of `non_member_profiles` keyed on `user_id` and merge it into a unified `customer` field with the same shape the dialog already reads (`first_name`, `last_name`, `email`, `stripe_customer_id`, `card_brand`, `card_last4`).
- Update `SpaCompletionDialog.tsx`:
  - `memberName` falls back to the non-member name
  - `hasCardOnFile` / `cardLabel` use the unified customer data
  - Keep the existing "Charge card on file" radio enabled for non-members with a saved card

### 5. Charge non-members through the existing edge function
In `SpaCompletionDialog.handleSubmit`, when paying by card:
- For members → keep the current `memberId` payload
- For non-members / guests → pass `stripeCustomerId` instead (the edge function already supports this branch)
- `description` stays the same: `Spa: <service>` + tip
- `payment_type: "spa_service"` stays the same

No edge function changes are required.

### 6. Light cleanup
- Rename the "Member" label in the modal to "Customer" so staff understand non-members are also valid.
- Update the empty-state placeholder to "Search by name or email — members, non-members, and saved guests."
- Keep the existing service / date / time / therapist / room / payment logic untouched.

## Files to update
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — unified search, selected customer state, insert payload
- `src/hooks/useAdminSpaAppointments.ts` — non-member fallback join and unified `customer` shape
- `src/components/admin/spa/SpaCompletionDialog.tsx` — read unified customer, charge by `stripeCustomerId` for non-members
- (Optional) extract the unified customer search into a small reusable `SpaCustomerSearch` component if it cleans up the modal

## Out of scope
- No database schema changes
- No edge function changes
- No changes to public `/spa` booking flow — this is admin-side only

## Expected result
- Admins can search by name or email and pick a member, non-member, or saved guest from one dropdown.
- Non-members with a signed waiver and a card on file can be booked into any spa service.
- The completion dialog can charge non-members' cards on file the same way it charges members.
- The appointments grid still shows the correct customer name regardless of member type.

