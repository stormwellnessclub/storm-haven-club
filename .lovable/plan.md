

# Fix Class Passes Page: Show Prices First, Sign Waiver at Checkout

## Problem
Right now, the Class Passes page **hides all pricing** behind a waiver wall. If someone hasn't signed the agreement, they can't even see what the classes cost. That's not practical -- people need to see prices before deciding to buy. The waiver should only be required when they're ready to purchase.

Additionally, the PDF agreement viewer uses an iframe-based approach that doesn't work on most iPhones and Android phones. Mobile users can't view the documents they need to sign.

## Solution

### 1. Show Prices to Everyone, Gate Only the Purchase Button
- Remove the waiver gate that wraps the entire pricing section
- Always show the pricing tables (to logged-in users and visitors alike)
- When a user clicks "Purchase" and hasn't signed the required waiver yet, show an inline prompt right there with a "Sign Agreement" action instead of silently blocking
- The prompt will include Download and Open buttons for the PDF so they can sign on the spot without leaving the page

### 2. Make PDF Agreements Mobile-Friendly
- Replace the iframe-based PDF display in `SimpleAgreementCard` and `AgreementPDFViewer` with a mobile-first approach
- On mobile devices (iPhone/Android), iframes cannot render PDFs -- they show a blank box or download prompt
- Change the approach to prioritize **"Open in New Tab"** and **"Download"** buttons (which already exist but are secondary)
- On mobile, skip the iframe entirely and show a clean card with the document name and two prominent action buttons
- The "Open" link uses a native `<a>` tag (already correct) which triggers the device's built-in PDF viewer on both iOS and Android

## Technical Details

### File: `src/pages/ClassPasses.tsx`
- Remove the `renderPricingContent()` function that conditionally shows waiver gates vs. pricing
- Always render `ClassPassPricingTables` for logged-in users
- Move the waiver check into `handlePurchase()` -- when the user clicks buy and hasn't signed, show a toast with a link to sign, or display an inline waiver signing card below the purchase button
- Keep the `AccountRequiredSection` for non-logged-in users (they still need to sign in first)

### File: `src/components/AgreementPDFViewer.tsx`
- Add mobile detection using the existing `useIsMobile()` hook pattern (or a simple UA/screen-width check)
- On mobile: skip the iframe, show a prominent card with "Open PDF" and "Download PDF" buttons only
- On desktop: keep the current iframe preview (it works fine on desktop browsers)

### File: `src/components/SimpleAgreementCard.tsx`
- This component already has "Open" and "Download" buttons that work on mobile
- Minor improvement: on mobile, make these buttons full-width and more prominent since they're the only way to view the document
- The existing blob-based download fallback already handles iOS Safari

### No database changes needed.

