

# Add Liability Waiver Requirement to Spa Booking

## What This Does

Before any member or non-member can book a spa service, they must have a signed liability waiver on file. If they haven't signed it yet, an inline signing flow appears directly in the booking modal — same pattern already used in the class `BookingModal`.

## Plan

### Step 1: Add waiver check to SpaBookingModal (member-facing)
- Import `useUserProfile` and `useNonMemberProfile` hooks to check `waiver_signed` status
- Import `useAgreements("liability_waiver")` to fetch the waiver PDF URL
- Add inline waiver signing UI (checkbox + sign button) identical to the existing pattern in `BookingModal.tsx` (lines 260-327)
- Block the date/time/payment form until the waiver is signed
- After signing, the form becomes available immediately without closing the modal

### Step 2: Remove the "Coming Soon" guard for non-Recovery services
- Remove lines 139-156 in `SpaBookingModal.tsx` that block non-Recovery service categories from being booked — all active spa services should be bookable with pre-charge at booking time

### Step 3: Add waiver check to AdminSpaBookingModal (staff-facing)
- When an admin selects a member, check their `waiver_signed` status from the profiles table
- If unsigned, show a warning badge indicating "Waiver not signed" and block the booking with a note that the member must sign the liability waiver first (via member portal or in-person)

## Technical Details
- **No database changes needed** — `profiles.waiver_signed` and `non_member_profiles.waiver_signed` columns already exist
- **Modified files**: `src/components/booking/SpaBookingModal.tsx`, `src/components/admin/spa/AdminSpaBookingModal.tsx`
- Reuses existing `useUserProfile().signWaiver()`, `useNonMemberProfile().signWaiver()`, and `useAgreements()` hooks

