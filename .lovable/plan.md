

# Fix Guest Pass Credit Deduction + Add Referral Tracking

## Problem 1: Credits Not Deducting
The `GuestPassRegistrationCard` component in `Credits.tsx` tries to update `member_credits` directly from the client:
```
supabase.from("member_credits").update({ credits_remaining: ... }).eq("id", credit.id)
```
This silently fails because RLS policies on `member_credits` only allow staff roles to modify records. The guest pass record is created successfully, but the credit balance never decreases.

## Problem 2: No Referral Tracking
The guest pass record stores `member_referral: "Complimentary Guest Pass"` as a generic string but does NOT store the member ID of who used the credit. This makes it impossible to trace which member referred which guest without cross-referencing `user_id` with the members table.

## Solution

### 1. Create a Database Function for Atomic Guest Pass Registration
Create an RPC function `redeem_guest_pass_credit` that:
- Validates the member has remaining guest pass credits
- Deducts the credit (runs as SECURITY DEFINER, bypassing RLS)
- Creates the guest pass record with the member's name as referral
- Returns success/failure atomically (no partial state)

### 2. Add `referring_member_id` Column to `guest_passes`
Add a nullable UUID column to track exactly which member used their complimentary credit. This provides instant lookup for "who referred this guest" without needing to cross-reference user IDs.

### 3. Update the Frontend Component
Replace the two separate client-side calls in `GuestPassRegistrationCard` with a single RPC call to the new function.

## Technical Details

### Migration SQL
- Add column: `ALTER TABLE guest_passes ADD COLUMN referring_member_id UUID REFERENCES members(id)`
- Create RPC: `redeem_guest_pass_credit(guest_name, guest_email, guest_phone, visit_date)` as SECURITY DEFINER
  - Looks up the calling user's member record
  - Finds their active guest_pass credit with remaining > 0
  - Decrements `credits_remaining` by 1
  - Inserts into `guest_passes` with `referring_member_id`, `price_paid: 0`, `user_id`, and `member_referral` set to the member's full name
  - Returns the created guest pass ID or an error

### Modified File: `src/pages/member/Credits.tsx`
- Replace the `handleSubmit` function in `GuestPassRegistrationCard` to call `supabase.rpc('redeem_guest_pass_credit', {...})` instead of two separate insert/update calls
- Remove the direct `member_credits` update (which was silently failing)
- Keep the same UI and form fields

### Admin Visibility
- The `referring_member_id` column will allow the admin Guest Passes page to show exactly which member referred each complimentary guest, making it instantly visible in the pass list

