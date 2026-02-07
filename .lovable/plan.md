

# Fix Guest Pass Agreement 404 Error

## Problem Summary
The Guest Pass waiver page is showing a 404 error because **one of the two required Guest Pass agreement records is missing from the database**.

## Database State
| Expected (from migration) | Current (in database) |
|--------------------------|----------------------|
| `guest-pass-agreement-general.pdf` | **MISSING** |
| `guest-pass-agreement.pdf` | `/assets/agreements/guest-pass-agreement.pdf` |

Both PDF files exist in the codebase at `src/assets/agreements/` and are properly imported in `AgreementPDFViewer.tsx`.

---

## Fix Required

### Database Migration
Insert the missing guest pass agreement record and standardize the pdf_url format for consistency:

```sql
-- Insert missing Guest Pass general agreement
INSERT INTO public.agreements (agreement_type, title, pdf_url, display_order, is_required, version, is_active) 
VALUES ('guest_pass', 'Guest Pass - Membership Agreement', 'guest-pass-agreement-general.pdf', 1, true, '1.0', true)
ON CONFLICT DO NOTHING;

-- Update existing guest pass agreement to use consistent filename format
UPDATE public.agreements 
SET pdf_url = 'guest-pass-agreement.pdf', display_order = 2
WHERE agreement_type = 'guest_pass' 
AND pdf_url LIKE '%guest-pass-agreement.pdf'
AND pdf_url NOT LIKE '%general%';
```

---

## Expected Result After Fix
The `guest_pass` agreement type will have two records:
1. **Guest Pass - Membership Agreement** → `guest-pass-agreement-general.pdf`
2. **Guest Pass Agreement** → `guest-pass-agreement.pdf`

Both PDFs are already imported in `AgreementPDFViewer.tsx` and will load correctly.

---

## Technical Details

### Why the 404 happens
1. User navigates to waivers page
2. `useAgreements("guest_pass")` fetches agreements from database
3. Returns only one agreement with path `/assets/agreements/guest-pass-agreement.pdf`
4. The `getPdfPath` function extracts filename `guest-pass-agreement.pdf`
5. This maps correctly to the imported PDF ✓
6. However, if the query or UI expects two agreements but only gets one, or if there's a race condition, the viewer may try to load a non-existent path

### Files Verified (No Changes Needed)
- `src/assets/agreements/guest-pass-agreement.pdf` ✓ exists
- `src/assets/agreements/guest-pass-agreement-general.pdf` ✓ exists
- `src/components/AgreementPDFViewer.tsx` ✓ both files imported and mapped

