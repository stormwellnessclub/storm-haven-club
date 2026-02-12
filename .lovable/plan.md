

## Fix Membership Agreement and Liability Waiver PDFs

### Problem
The membership agreement PDF doesn't load on the Apply page or the Waivers page -- same issue as the guest pass: the file in `src/assets/agreements/membership-agreement.pdf` is corrupted/outdated, causing blank downloads and 404 errors when opened in a new tab.

### Solution

**Replace two PDF files with the uploaded working copies:**

1. **`src/assets/agreements/membership-agreement.pdf`** -- overwrite with the uploaded `agreements_membership-agreement.pdf`
2. **`src/assets/agreements/liability-waiver.pdf`** -- overwrite with the uploaded `liability-waiver-2.pdf` (updated version)

No code changes needed -- the existing `pdfAssets.ts` already maps both filenames (`membership-agreement.pdf` and `liability-waiver.pdf`) to Vite-hashed asset URLs. The Apply page's `AgreementPDFViewer` and the Waivers page's `SimpleAgreementCard` both resolve through this same mapping. Replacing the binary files will fix loading everywhere these documents are referenced.

### What this fixes
- Membership Agreement on the Apply page (embedded PDF viewer)
- Membership Agreement on the Member Waivers page (download/open buttons)
- Liability Waiver everywhere (now using the latest version you provided)
- Any other page that references these filenames through `pdfAssets.ts`

