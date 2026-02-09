

## Fix: Members Cannot Download Waivers/PDFs

### Root Cause

Vite does not include `.pdf` files in its default list of recognized asset types. When `SimpleAgreementCard.tsx` does `import liabilityWaiver from "@/assets/agreements/liability-waiver.pdf"`, Vite may not bundle these correctly, resulting in broken paths at runtime. The Download and Open buttons silently fail because the resolved URL points nowhere valid.

### Solution: Move PDFs to `public/` and simplify path resolution

The most reliable approach is to serve PDFs from the `public/` directory (which Vite serves as-is, no bundling) and remove the fragile import-based approach entirely.

### Changes

**1. Move PDF files to `public/agreements/`**

Move all PDFs from `src/assets/agreements/` to `public/agreements/` so they are served as static files at predictable URLs like `/agreements/liability-waiver.pdf`.

**2. Simplify `src/components/SimpleAgreementCard.tsx`**

- Remove all 9 PDF `import` statements and the `pdfMap` lookup table
- Simplify `getPdfPath()` to just prepend `/agreements/` to bare filenames (which is what the database stores, e.g. `liability-waiver.pdf`)
- Keep the existing Download and Open button logic -- it will now work because the URLs resolve correctly

**3. Add `assetsInclude` to `vite.config.ts` as a safety net**

Add `assetsInclude: ['**/*.pdf']` to the Vite config so any remaining or future PDF imports are handled correctly.

### Why this fixes it

- PDFs in `public/` are served verbatim by the web server at `/agreements/filename.pdf` -- no bundling, no hashing, no import resolution issues
- The database stores `liability-waiver.pdf` as the `pdf_url` -- the simplified `getPdfPath` just maps this to `/agreements/liability-waiver.pdf`
- Download and Open buttons will work immediately for all members, signed or unsigned

### Files affected

| File | Change |
|------|--------|
| `public/agreements/` | Move all PDFs here from `src/assets/agreements/` |
| `src/components/SimpleAgreementCard.tsx` | Remove PDF imports and pdfMap; simplify getPdfPath to use `/agreements/` prefix |
| `vite.config.ts` | Add `assetsInclude: ['**/*.pdf']` as safety net |

