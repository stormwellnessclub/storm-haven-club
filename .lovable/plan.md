

## Fix Membership Agreement and Liability Waiver on Mobile

### Problem
The membership agreement and liability waiver PDFs are not loading on mobile devices (iOS Safari in particular). Mobile browsers cannot display PDFs inline via iframes, and popup-based approaches are often blocked.

### Solution
Two-part fix:

**1. Replace PDF files with the uploaded versions**
- Copy `agreements_membership-agreement-2.pdf` to `src/assets/agreements/membership-agreement.pdf` (overwrite)
- Copy `liability-waiver-3.pdf` to `src/assets/agreements/liability-waiver.pdf` (overwrite)
- No changes needed in `pdfAssets.ts` since the filenames stay the same

**2. Improve mobile PDF experience in SimpleAgreementCard**
The current `openPdf` function uses `window.open` with a `window.location.href` fallback -- the fallback navigates the user **away** from the app entirely, which is a bad experience. Instead:

- Detect mobile using the existing `useIsMobile` hook
- On mobile, skip the iframe entirely and only show **Download** and **Open in New Tab** buttons (the current approach)
- Change the "Open" button to use an `<a>` tag with `target="_blank" rel="noopener noreferrer"` instead of JavaScript `window.open`, which is more reliable on iOS Safari
- Remove the `window.location.href` fallback that navigates away from the app
- For the download button, keep the blob-fetch approach (already works well on mobile)

### Files to Change

| File | Change |
|------|--------|
| `src/assets/agreements/membership-agreement.pdf` | Replace with uploaded version |
| `src/assets/agreements/liability-waiver.pdf` | Replace with uploaded version |
| `src/components/SimpleAgreementCard.tsx` | Replace `window.open` / `window.location.href` with native `<a target="_blank">` link for the Open button; keep blob download for Download button |

### Technical Details
- The `<a target="_blank">` approach is more reliable than `window.open()` on iOS Safari because the browser treats it as a user-initiated navigation rather than a popup
- The blob-based download is already implemented and works on mobile
- No database changes needed -- the `agreements` table already references `liability-waiver.pdf` and `membership-agreement.pdf` which map correctly through `pdfAssets.ts`

