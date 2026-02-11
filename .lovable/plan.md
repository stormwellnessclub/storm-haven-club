

## Fix Waivers and Agreements - PDFs Not Loading

### Problem
All agreement PDFs fail to load, download blank, and don't open in new tabs. The root cause is that paths like `/agreements/liability-waiver.pdf` are intercepted by React Router's catch-all route instead of being served as static files. This affects both the inline viewer and download/open buttons.

### Root Cause
- `SimpleAgreementCard.tsx` (used on the Waivers page) resolves PDF URLs to `/agreements/filename.pdf`
- React Router catches these paths and renders the app shell (blank page or 404)
- `AgreementPDFViewer.tsx` already has a working solution: it imports PDFs via Vite and maps filenames to hashed asset URLs (e.g., `/assets/liability-waiver-abc123.pdf`) that bypass the router
- But `SimpleAgreementCard` doesn't use this import map

### Solution
Create a shared PDF resolution utility that both components use, leveraging Vite's static imports to generate correct asset URLs.

### Files to Change

**1. Create `src/lib/pdfAssets.ts`** (new file)
- Move all PDF imports and the filename-to-URL map here
- Export a single `resolvePdfUrl(input: string): string` function
- This centralizes PDF resolution so all components use the same logic

**2. Update `src/components/SimpleAgreementCard.tsx`**
- Replace the local `getPdfPath` function with the shared `resolvePdfUrl` from `pdfAssets.ts`
- This ensures Download and Open buttons use the correct Vite-hashed URLs

**3. Update `src/components/AgreementPDFViewer.tsx`**
- Remove the local PDF imports and `pdfMap`
- Use the shared `resolvePdfUrl` from `pdfAssets.ts`
- No functional change, just consolidation

### Technical Details

The shared utility will:
1. Import all PDFs from `src/assets/agreements/` at build time (Vite resolves these to hashed URLs like `/assets/liability-waiver-a1b2c3.pdf`)
2. Map bare filenames (e.g., `liability-waiver.pdf`) to the correct hashed URL
3. Pass through full HTTP URLs unchanged
4. Fall back to `/agreements/filename` for any unmapped files

This approach works because Vite's import system generates URLs that are served directly by the dev server and production build, completely bypassing React Router.

