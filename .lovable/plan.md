

## Two Changes to the Membership Application

### 1. Remove Dispute/Chargeback Language

The bullet point "Do not apply if you are not ready to commit. Disputes and chargebacks for authorized charges will be contested." in the STOP warning card will be shortened to just:

**"Do not apply if you are not ready to commit."**

The dispute/chargeback sentence is removed entirely.

**File:** `src/pages/Apply.tsx` (line 1490)

---

### 2. Simplify Membership Agreement to Download-Only (All Devices)

Right now, desktop users see an embedded PDF iframe viewer (via `AgreementPDFViewer`), which is causing 404 errors. The fix is to remove the iframe entirely and show **only** the download/open buttons on all devices -- not just mobile.

The `MembershipAgreementSection` component (lines 194-307) will be simplified to always show the download card UI (the same one mobile currently gets), removing the desktop iframe branch completely. This means:

- A prominent "Download Agreement" button (blob download for reliability)
- An "Open in Browser" link as a secondary option
- The checkbox to confirm they've read it stays the same

**File:** `src/pages/Apply.tsx` -- `MembershipAgreementSection` component (lines 240-273 replaced with download-only UI for all screen sizes)

### Technical Details

| File | Lines | Change |
|------|-------|--------|
| `src/pages/Apply.tsx` | 1490 | Remove "Disputes and chargebacks for authorized charges will be contested." from the bullet text |
| `src/pages/Apply.tsx` | 240-273 | Remove the mobile/desktop branching logic and `AgreementPDFViewer` usage; always render the download buttons UI regardless of device |

