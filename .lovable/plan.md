
# Fix Guest Pass Waiver Signing Flow

## Problem Summary

1. **Guest Pass page requires 2 agreements** (Liability Waiver + Guest Pass Agreement)
2. **Guest Pass has 2 documents** that display in tabs - the second document shows 404
3. **Iframe embed is unreliable** - PDFs fail to load in production, blocking the purchase form
4. **User cannot proceed** - Cannot sign waivers → Cannot see guest pass purchase form

## Solution

Replace the error-prone embedded PDF iframe viewer with a simple, reliable **Download/Open + Acknowledge + Sign** pattern.

## Technical Changes

### 1. Create `SimpleAgreementCard.tsx`

New component that shows:
- Agreement title and description
- Download PDF button for each document
- Open in New Tab button for each document
- Checkbox: "I have reviewed this agreement"
- Sign button (enabled only after checkbox)

### 2. Update `InlineWaiverGate.tsx`

Replace `AgreementPDFViewer` with `SimpleAgreementCard`:
- For single-document agreements: Show one card
- For multi-document agreements (like guest_pass with 2 PDFs): Show each document with download/open buttons
- Keep the accordion structure for multiple waiver types

### 3. Update `src/pages/member/Waivers.tsx`

Replace `AgreementCard` component to use the same simple pattern:
- Remove iframe-based `AgreementPDFViewer`
- Use download/open buttons instead
- Add acknowledgment checkbox before signing

## UI Design

```text
+------------------------------------------------------------------+
|  Guest Pass Agreement                               [Required]   |
|  ----------------------------------------------------------------|
|                                                                  |
|  Please review the following document(s):                        |
|                                                                  |
|  Document 1: Guest Pass Agreement                                |
|  [Download PDF]  [Open in New Tab]                               |
|                                                                  |
|  Document 2: Guest Pass - General Agreement                      |
|  [Download PDF]  [Open in New Tab]                               |
|                                                                  |
|  [ ] I have reviewed all documents above                         |
|                                                                  |
|  [I Agree - Sign Guest Pass Agreement] (disabled until checked)  |
+------------------------------------------------------------------+
```

## Files to Change

| File | Action |
|------|--------|
| `src/components/SimpleAgreementCard.tsx` | Create new component |
| `src/components/InlineWaiverGate.tsx` | Replace AgreementPDFViewer with SimpleAgreementCard |
| `src/pages/member/Waivers.tsx` | Update to use simple download/open pattern |

## Benefits

- **No more 404 errors** - No iframe loading issues
- **Faster loading** - No waiting for PDF to embed
- **Works everywhere** - Downloads/opens work on all browsers
- **Explicit acknowledgment** - User must confirm they reviewed before signing
- **Guest pass form visible** - Users can complete purchase after signing
