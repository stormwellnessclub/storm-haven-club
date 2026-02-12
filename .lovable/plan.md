

## Fix Guest Pass Flow: Inline Agreement Signing + Replace Broken PDFs

### Problem
1. **Broken PDFs**: The liability waiver and guest pass agreement PDFs download as blank pages / show 404 errors. The actual files in `src/assets/agreements/` are corrupted or outdated.
2. **Confusing flow**: When a guest needs to sign agreements, they see a message telling them to navigate to the member portal Waivers page -- a confusing redirect for someone just trying to buy a guest pass.

### Solution

**Part 1: Replace broken PDF files**
- Overwrite `src/assets/agreements/liability-waiver.pdf` with the uploaded working copy
- Overwrite `src/assets/agreements/guest-pass-agreement-general.pdf` with the uploaded working copy
- Vite will re-hash and serve them correctly -- no code changes needed for resolution since `pdfAssets.ts` already maps these filenames

**Part 2: Inline agreement signing on the Guest Pass page**
Instead of redirecting to `/member/waivers`, show the agreements directly on the Guest Pass page before the purchase form. The guest reviews and signs each one in sequence, then the form appears -- all on a single page.

### Technical Details

**Files replaced (binary):**
- `src/assets/agreements/liability-waiver.pdf` -- replaced with user upload
- `src/assets/agreements/guest-pass-agreement-general.pdf` -- replaced with user upload

**File modified: `src/pages/GuestPass.tsx`**
- Remove the `InlineWaiverGate` wrapper (which currently redirects to the Waivers page)
- Import `useUserProfile` hook to check `waiver_signed` and `guest_pass_agreement_signed` flags, and call the sign mutations
- Import `SimpleAgreementCard` to render the inline signing UI
- Import `resolvePdfUrl` from `pdfAssets.ts` to get working PDF URLs
- Add logic: if `waiver_signed` is false, show the Liability Waiver signing card (with Download/Open buttons for the PDF, checkbox, and Sign button)
- Once the liability waiver is signed, if `guest_pass_agreement_signed` is false, show the Guest Pass Agreement signing card
- Once both are signed, render the `GuestPassForm` -- no redirect, no page reload needed (React Query invalidation updates the profile automatically)
- The signing cards use the same `SimpleAgreementCard` component already used on the Waivers page, keeping the UI consistent

**Flow after changes:**
1. Guest creates account or signs in (unchanged)
2. If Liability Waiver is unsigned: inline signing card appears with PDF download/open + "I Agree" button
3. If Guest Pass Agreement is unsigned: inline signing card appears next
4. Once both signed: purchase form renders immediately on the same page

**No changes needed to:**
- `InlineWaiverGate.tsx` -- still used by other pages
- `WaiverRequiredAlert.tsx` -- still used elsewhere
- `pdfAssets.ts` -- already maps both filenames correctly
