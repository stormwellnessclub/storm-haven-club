
# Complete Waiver System Fix - Database, Workflow, and Enforcement

## Critical Issues Identified

### Issue 1: Database Schema Mismatch (BLOCKING ERROR)
**Error**: "Could not find the 'guest_pass_agreement_signed_at' column of 'profiles' in the schema cache"

The `profiles` table is **missing** these columns that the code expects:
- `guest_pass_agreement_signed_at` (timestamp)
- `single_class_pass_agreement_signed_at` (timestamp)
- `kids_care_service_form_completed_at` (timestamp)
- `class_package_agreement_signed` (boolean)
- `class_package_agreement_signed_at` (timestamp)

**Database HAS**:
- `guest_pass_agreement_signed` (boolean only, no `_at`)
- `single_class_pass_agreement_signed` (boolean only, no `_at`)
- `kids_care_service_form_completed` (boolean only, no `_at`)
- NO `class_package_agreement_*` columns at all

### Issue 2: Missing Agreement Workflow Logic
Currently there is no enforcement of WHO should sign WHICH agreements:

| User Type | Should Sign | Currently Enforced? |
|-----------|-------------|---------------------|
| Guest (buying guest pass) | Liability + Guest Pass | Partial (Guest Pass only) |
| Non-member (buying single class) | Liability + Single Class Pass | Partial |
| Member (booking classes) | Liability + Membership | Only at activation |
| Member (using Kids Care) | Liability + Kids Care | Yes |
| Member (10-class pack) | Liability + Class Package | No enforcement |

### Issue 3: No Enforcement During Booking
When a user with a pass tries to book a class, there's a backup check in `useBooking.ts` but it just throws an error. Users should be redirected to sign agreements before reaching this point.

### Issue 4: Member Waivers Page Shows Everything
The `/member/waivers` page shows ALL agreement types to ALL users, even though:
- Guests don't need membership agreements
- Non-members don't need class package agreements
- The "signed at" timestamps fail for missing columns

## Solution Overview

### Phase 1: Database Migration
Add the missing columns to the `profiles` table:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kids_care_service_form_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed_at TIMESTAMPTZ;
```

### Phase 2: Smart Waivers Page
Update the waivers page to only show relevant agreements based on user context:

| Agreement | Show When |
|-----------|-----------|
| Liability Waiver | Always (required for all) |
| Membership Agreement | User is a member OR has pending application |
| Kids Care | Has kids care pass OR is member |
| Guest Pass | Has guest pass OR visiting from guest-pass page |
| Single Class Pass | Has single class pass OR visiting from class-passes page |
| Class Package | Has 10-pack OR visiting from class-passes page |
| Private Event | Has event booking OR visiting from events page |

The `returnUrl` parameter already passed from purchase pages can be used to detect context.

### Phase 3: Enhanced Blocking Logic
Create a centralized hook to check agreement requirements before actions:

```typescript
// New hook: useAgreementEnforcement
function useAgreementEnforcement() {
  // For booking a class:
  // - Check if using guest pass -> need guest_pass_agreement
  // - Check if using single class pass -> need single_class_pass_agreement
  // - Check if using 10-pack -> need class_package_agreement
  // - Check if using member credits -> need membership_agreement
}
```

### Phase 4: Flow Enforcement Points

**Point 1: Before Purchasing**
Already implemented with `InlineWaiverGate`:
- Guest Pass page: requires `guest_pass` agreement
- Class Passes page: requires `single_class_pass` agreement (for single)

Need to add:
- Class Passes page: requires `class_package` agreement (for 10-packs)

**Point 2: Before Booking**
Update `BookingModal.tsx` to check agreements based on selected payment method:
- Using guest pass → check `guest_pass_agreement_signed`
- Using single class pass → check `single_class_pass_agreement_signed`
- Using class pack → check `class_package_agreement_signed`
- Using member credits → check `membership_agreement_signed`

If not signed, show redirect to `/member/waivers?return=...`

**Point 3: Member Portal Access**
Keep current behavior: members can access portal regardless of agreement status, but see notices for required actions.

## Technical Changes

### File: Database Migration (NEW)
Add missing columns to profiles table.

### File: `src/hooks/useUserProfile.ts`
Update to handle the new columns properly (already has correct interface, just needs DB columns).

### File: `src/pages/member/Waivers.tsx`
- Extract context from `returnUrl` to prioritize relevant agreements
- Group agreements into "Required for Your Purchase" and "Other Agreements"
- Only show "signed at" dates for columns that exist
- Add logic to detect user type (guest vs member)

### File: `src/components/InlineWaiverGate.tsx`
- Already working correctly for redirect pattern
- Add handling for `class_package` waiver type

### File: `src/pages/ClassPasses.tsx`
- Split waiver requirements: single passes need `single_class_pass`, 10-packs need `class_package`
- Show appropriate gate based on what user is trying to purchase

### File: `src/components/booking/BookingModal.tsx`
- Add agreement check before booking based on payment method
- Show inline redirect alert if agreement not signed
- Use `WaiverRequiredAlert` component for consistency

### File: `src/hooks/useBooking.ts`
- Keep backup server-side check as safety net
- Improve error messages with direct links

## Implementation Order

1. **Database Migration** (fixes the blocking error)
2. **Update Waivers Page** (show relevant agreements, fix timestamp display)
3. **Add Class Package Gate** to ClassPasses page
4. **Add Agreement Check** to BookingModal
5. **Test Full Flows**:
   - Guest: create account → sign liability → buy guest pass → sign guest pass agreement → book class
   - Non-member: create account → sign liability → buy single pass → sign single pass agreement → book class
   - Member: apply → activate → sign membership agreement → book with credits

## UI/UX Improvements

### Waivers Page Sections
```text
+------------------------------------------+
| 🔔 Required for Your Purchase             |
|   [Guest Pass Agreement] - Sign Now       |
+------------------------------------------+
| ✅ Completed                              |
|   [Liability Waiver] - Signed Jan 5       |
+------------------------------------------+
| 📋 Other Agreements (Optional)            |
|   [Kids Care] - Sign when needed          |
|   [Private Events] - Sign when needed     |
+------------------------------------------+
```

### Booking Modal Check
```text
+------------------------------------------+
| ⚠️ Agreement Required                     |
|                                           |
| To book using your Single Class Pass,     |
| please sign the Single Class Pass         |
| Agreement first.                          |
|                                           |
| [Go to Waivers & Agreements →]            |
+------------------------------------------+
```

## Success Criteria

1. No database errors when signing any agreement
2. Guest users only see/need guest-related agreements
3. Members see membership agreements prominently
4. Users cannot book classes without required agreements
5. Clear, contextual messaging at each checkpoint
6. Return URL flow works smoothly after signing
