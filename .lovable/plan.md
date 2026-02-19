

## Make Waivers Phone-Friendly and Enforce at Checkout

### Current State

- **PDF viewing on mobile is already handled**: `SimpleAgreementCard` and `AgreementPDFViewer` detect mobile devices and show large "Open PDF" / "Download" buttons instead of broken iframes. No changes needed here.
- **Class pass purchase page** (`/class-passes`) already has an inline waiver prompt (`InlineWaiverPrompt`) that appears when you click "Purchase" without signing the required pass-specific agreement. This works on mobile.
- **The gap**: The **liability waiver** (`waiver_signed`) is never checked at the booking or purchase step. Users can book classes or buy passes without ever signing it.

### Changes

#### 1. Add liability waiver check to BookingModal (at booking time)

**File: `src/components/booking/BookingModal.tsx`**

Add a check for `profile?.waiver_signed` before allowing any booking to proceed. If the liability waiver is not signed:
- Show an alert with a clear message and a button to sign the waiver
- Hide the payment method selection and "Confirm Booking" button
- The alert takes priority over pass-specific agreement checks (liability waiver is universal)
- For non-members (no `profile`), direct them to sign in first since they need a profile to track waiver status

This means users browse the schedule freely, tap "Book", and only then see the waiver requirement -- exactly at checkout, not before.

#### 2. Add liability waiver check to ClassPasses purchase flow (at purchase time)

**File: `src/pages/ClassPasses.tsx`**

Update `handlePurchase` to check `profile?.waiver_signed` before the pass-specific agreement check. If liability waiver is not signed:
- Show the `InlineWaiverPrompt` for the liability waiver type
- Add `"liability_waiver"` to the `signerMap` inside `InlineWaiverPrompt` so the sign function (`signWaiver`) is mapped correctly
- Users see prices, browse freely, and only when they click "Purchase" does the waiver prompt appear inline on the same page

#### 3. Ensure InlineWaiverPrompt supports liability waiver type

**File: `src/pages/ClassPasses.tsx` (InlineWaiverPrompt component)**

The existing `signerMap` only maps `single_class_pass` and `class_package`. Add an entry for `liability_waiver` that maps to `profileHook.signWaiver` and `profileHook.isSigningWaiver`. This allows the same inline signing flow to work for the liability waiver without navigating away.

### User Flow After Changes

**Booking a class:**
1. User browses schedule on phone -- no waiver blocking
2. User taps "Book Class" on a session
3. BookingModal opens showing class details
4. If liability waiver not signed: shows a clear alert with "Sign Liability Waiver" button that navigates to `/member/waivers`
5. If liability waiver signed but pass agreement missing: shows the existing pass-agreement alert
6. If all signed: shows payment method selection and "Confirm Booking"

**Purchasing a class pass:**
1. User browses `/class-passes` -- sees all prices, no blocking
2. User taps "Purchase" button
3. If liability waiver not signed: inline waiver prompt appears on the same page (mobile-friendly PDF open/download + checkbox + sign button)
4. After signing liability waiver, user taps "Purchase" again
5. If pass-specific agreement not signed: inline prompt appears for that agreement
6. After signing, purchase proceeds to Stripe Checkout

### Files to Modify

| File | Change |
|------|--------|
| `src/components/booking/BookingModal.tsx` | Add liability waiver check before payment method selection |
| `src/pages/ClassPasses.tsx` | Add liability waiver check in `handlePurchase`; add `liability_waiver` to `InlineWaiverPrompt` signer map |

### What Already Works on Mobile (No Changes Needed)

- `SimpleAgreementCard`: Uses `useIsMobile()` to show large "Open PDF" and "Download" buttons
- `AgreementPDFViewer`: Renders `MobilePDFCard` on phones instead of iframe
- `InlineWaiverPrompt`: Uses `SimpleAgreementCard` which is already mobile-safe
- Waivers page (`/member/waivers`): Full signing flow works on mobile

### No new files, no database changes needed.

