
# Waiver System Consistency Review and Bug Fixes

## Issues Found

### 1. Missing Class Package Agreement in Waivers Page

**Bug**: The `src/pages/member/Waivers.tsx` page does NOT include the `class_package` agreement type, but the system supports it in:
- `InlineWaiverGate.tsx` (line 74-80)
- `useUserProfile.ts` (has `signClassPackageAgreement` mutation)
- Database schema has `class_package_agreement_signed` field

**Impact**: Users cannot sign the Class Package Agreement from the portal, but the system expects it to be signed.

### 2. Missing Class Package Agreement PDF in SimpleAgreementCard

**Bug**: The `pdfMap` in `SimpleAgreementCard.tsx` does NOT include any `class-package-agreement.pdf` entry. If a class_package agreement is configured in the database, the PDF resolution will fail.

**Current pdfMap includes**:
- liability-waiver.pdf
- membership-agreement.pdf  
- kids-care-agreement.pdf
- kids-care-agreement-parent-consent-form.pdf
- guest-pass-agreement-general.pdf
- guest-pass-agreement.pdf
- private-event-agreement.pdf
- single-class-pass-agreement.pdf
- single-class-pass-agreement-2.pdf

**Missing**: No `class-package-agreement.pdf`

### 3. ClassPasses.tsx Shows Pricing Tables Even When Agreement Alert is Shown

**Bug**: In `ClassPasses.tsx` (lines 352-371), when `needsAgreement` is true, it shows BOTH the `InlineWaiverGate` alert AND the pricing tables below it. This is confusing because:
- Users see the "Agreement Required" alert
- BUT also see purchase buttons they cannot use
- Clicking purchase shows a toast "Please sign the Single Class Pass Agreement first"

**Expected Behavior**: Either hide the pricing tables until agreement is signed, OR make the flow clearer.

### 4. Inconsistent Waiver Check in useBooking.ts

**Bug**: The `useBooking.ts` hook (lines 190-207) checks for `guest_pass_agreement_signed` and `single_class_pass_agreement_signed` during class booking, but this is a server-side backup check that throws an error. This creates an inconsistent UX where:
- User sees the waiver alert before purchasing passes
- But if they somehow bypass it, they get an error message during booking
- The error message says "Please sign the agreement on the Waivers & Agreements page before booking" but doesn't provide a link

### 5. Auth.tsx Immediate Navigation After Sign-Up

**Potential Bug**: In `Auth.tsx` (line 200), after successful sign-up, the code calls `navigate(getRedirectTarget())` immediately. However, the profile check and waiver step happen in a separate `useEffect` (lines 99-112). This could cause a race condition where:
- User signs up
- Navigate is called
- useEffect tries to show waiver step but navigation already happened

The code SHOULD rely entirely on the useEffect for post-auth navigation to ensure the waiver step is shown.

### 6. Missing Kids Care Agreement Check Before Booking Modal Opens

**Observation**: The `KidsCareBookingModal.tsx` correctly checks for `kids_care_agreement_signed` (line 92) and redirects to `/member/waivers`. This is good but uses a different pattern than `InlineWaiverGate`. It's consistent in outcome but inconsistent in implementation.

## Proposed Fixes

### Fix 1: Add Class Package Agreement to Waivers Page

Add the Class Package Agreement section to `src/pages/member/Waivers.tsx`:
- Fetch class package agreements
- Add AgreementSection for class_package
- Wire up `signClassPackageAgreement` mutation

### Fix 2: Add Class Package PDF to SimpleAgreementCard

If a class package agreement PDF exists, add it to the pdfMap:
```typescript
'class-package-agreement.pdf': classPackageAgreement,
```

If no PDF exists yet, this should be flagged as a missing asset.

### Fix 3: Improve ClassPasses.tsx UX

Option A: Hide pricing tables when agreement is needed
Option B: Keep tables visible but show a clearer overlay/banner explaining the required step

Recommend Option A for consistency with guest pass flow.

### Fix 4: Fix Auth.tsx Race Condition

Remove the `navigate(getRedirectTarget())` call from the `handleSubmit` success path (lines 200 and 222). Let the useEffect handle all post-auth navigation to ensure waiver step is always shown when needed.

### Fix 5: Add Return URL Support to useBooking Error Messages

Update the error messages in `useBooking.ts` to be more helpful, though the primary fix should be preventing users from reaching this state in the first place.

## File Changes Summary

| File | Change |
|------|--------|
| `src/pages/member/Waivers.tsx` | Add Class Package Agreement section |
| `src/components/SimpleAgreementCard.tsx` | Add class-package-agreement.pdf to pdfMap (if PDF exists) |
| `src/pages/ClassPasses.tsx` | Hide pricing tables when agreement is required (match GuestPass pattern) |
| `src/pages/Auth.tsx` | Remove redundant navigate calls from handleSubmit, rely on useEffect for waiver flow |
| `src/hooks/useBooking.ts` | Improve error message wording (low priority) |

## Assets to Verify

Check if `src/assets/agreements/class-package-agreement.pdf` exists:
- If YES: Add import and pdfMap entry
- If NO: Either create a placeholder or skip this agreement type

## Testing Checklist

After fixes, verify:
1. Guest Pass flow: Account creation -> Liability waiver -> Guest Pass agreement -> Purchase
2. Class Pass flow: Sign in -> Single Class agreement shown if needed -> Purchase
3. Kids Care flow: Check agreement -> Service form -> Booking
4. Member Waivers page: All 7 agreement types displayed correctly
5. Return URL: After signing, user returns to original purchase page
