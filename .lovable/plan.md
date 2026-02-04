
# Class Pass Purchase Flow - Fix Plan

## Issues Identified

### Issue 1: Footer Links Not Clickable in Member Portal
**Root Cause:** The Member Portal uses `MemberLayout.tsx` which does NOT include the Footer component. The Footer is only included in the public `Layout.tsx`. This is intentional design - the member portal is a dashboard layout with a sidebar, not a traditional page layout with a footer.

**What you're seeing:** If there's a footer-like area visible, it may be content within a page, not the actual Footer component.

**Solution:** This is expected behavior - the member portal uses sidebar navigation instead of footer links. The "Buy Passes" link in the sidebar correctly links to `/class-passes`.

---

### Issue 2: "Buy Class Pass" Opens Stripe in New Tab Instead of Staying On-Site
**Root Cause:** In `ClassPasses.tsx` line 77, the code explicitly opens Stripe Checkout in a new tab:
```javascript
window.open(data.url, '_blank');  // Opens in new tab
```

**Solution:** Change from `window.open(data.url, '_blank')` to `window.location.href = data.url` to redirect in the same tab, OR implement an embedded checkout using Stripe Elements.

---

### Issue 3: Single Class Pass Purchase → Flickering/Shaking Waivers Page
**Root Cause:** When you click to buy a single class pass, the code checks if `single_class_pass_agreement_signed` is false (lines 51-55 in ClassPasses.tsx). If not signed, it navigates to `/member/waivers`.

However, the `agreements` table in the database has **NO `single_class_pass` agreement records** - only `membership_agreement` exists. This causes the Waivers page to render with missing PDF data, potentially causing layout instability.

Additionally, the AgreementPDFViewer imports multiple PDF files that may not load correctly, causing re-renders and flickering.

**Solution:** 
1. Add `single_class_pass` agreement records to the database, OR
2. Skip the agreement requirement for single class passes if no agreement is configured

---

### Issue 4: 10-Class Pack Purchase Does Nothing
**Root Cause:** The same code path runs for both single and 10-pack purchases. The issue is that:
1. For `passType: 'single'`, there's an additional waiver check that redirects (line 51-55)
2. For `passType: 'tenPack'`, there's no waiver requirement, so it should proceed directly

The 10-pack button calls `handlePurchase('pilatesCycling', 'tenPack')` which should invoke the edge function. If nothing happens, it's likely a silent error in the Stripe function invocation.

**Solution:** Add error handling/logging to diagnose why the Stripe function isn't returning or the button click isn't registering.

---

## Implementation Plan

### Step 1: Fix Stripe Checkout Redirect (Keep on same site)
**File:** `src/pages/ClassPasses.tsx`
- Change `window.open(data.url, '_blank')` to `window.location.href = data.url`

### Step 2: Fix Single Class Pass Waiver Requirement
**File:** `src/pages/ClassPasses.tsx`  
- Only require waiver signature if agreements actually exist in database
- Add fallback logic if no single class pass agreement is configured

### Step 3: Add Better Error Handling for 10-Pack Purchases
**File:** `src/pages/ClassPasses.tsx`
- Add console logging to trace button click
- Ensure the loading state properly resets on errors
- Add network error toast notifications

### Step 4: Add Missing Agreement Records (Database)
Add the following agreement records to the `agreements` table:
- `single_class_pass` agreement with PDF URLs pointing to existing files

---

## Technical Details

### Files to Modify:
1. `src/pages/ClassPasses.tsx` - Fix redirect behavior and waiver check
2. Database: Insert `single_class_pass` agreement records (or skip requirement)

### Code Changes Summary:

**ClassPasses.tsx changes:**
```typescript
// Line 77: Change from new tab to same page
window.location.href = data.url;  // Instead of window.open(data.url, '_blank')

// Lines 51-55: Make waiver check conditional on agreement existence
if (passType === 'single' && needsAgreement && hasAgreementConfigured) {
  // Only redirect if agreements actually exist
}
```

### Database Changes:
Option A: Insert agreement records for single_class_pass type
Option B: Update code to skip waiver check if no agreements configured

---

## Expected Results After Fix:
1. ✅ Footer links work normally on public pages (member portal uses sidebar by design)
2. ✅ Class pass purchases redirect in same tab to Stripe Checkout
3. ✅ Single class pass purchase either goes to properly-loaded waivers page OR proceeds directly
4. ✅ 10-class pack purchases work with proper error feedback
