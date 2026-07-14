## Goal
Prepare a compliant v2 of the Membership Agreement but keep it **inactive/draft** so it does NOT replace the currently-signed contract. Other site edits you publish later will not activate it.

## How the agreements system works today
- Table: `public.agreements` (rows keyed by `agreement_type`, `is_active`, `version`, `effective_date`, `pdf_url`).
- `useAgreements("membership_agreement")` and `useAllAgreements` filter on `is_active = true`. Anything with `is_active = false` is invisible to signup, waiver, and portal flows.
- PDFs are resolved through `src/lib/pdfAssets.ts` — only filenames listed in the `pdfMap` are servable. A new file must be added there to be viewable in-app, but adding it there alone does NOT make members sign it.

## Plan — "save, don't ship"

1. **Generate v2 PDF as a draft file only**
   - Write a new file: `src/assets/agreements/membership-agreement-v2-draft.pdf` (and mirror to `public/agreements/` for direct link preview).
   - Content: current agreement + all fixes from the audit (3-day right to cancel, HCSA statutory cancellation events, total-price disclosure, MCPA-safe severability/no-waiver, explicit early-termination + acceleration clause, auto-renewal conspicuous notice).
   - Filename ends in `-v2-draft.pdf` so it is obvious in storage this is not live.

2. **Register it in `pdfAssets.ts` but do NOT insert a live DB row**
   - Add the draft filename to `pdfMap` so you (admin) can open/preview it from a link.
   - Do **not** call `useCreateAgreement`, do **not** insert into `public.agreements`, do **not** flip `is_active`. Current signed v1 stays the only active membership agreement.

3. **Admin-only preview link**
   - Add a single "Preview draft v2 (not live)" link on `src/pages/admin/SignatureCertificates.tsx` (or Settings) that opens the draft PDF in a new tab. Visible to admins only. No member-facing surface changes.

4. **Publish safety**
   - Because no DB row is created and no active-agreement query is touched, publishing unrelated frontend changes will not activate v2. Applicants and members continue to see and sign v1 exactly as today.

5. **Activation later (separate future step, not in this plan)**
   - When you approve v2, we will: insert a new `agreements` row (`agreement_type='membership_agreement'`, `version='2.0'`, `effective_date=<date>`, `is_active=true`) and set the old row `is_active=false` in the same migration. Only then does v2 become the signed contract for new members. Existing signed v1 contracts remain historically valid.

## Technical details
- No migration in this plan.
- No changes to `useAgreements`, `useAllAgreements`, `WaiverSigningStep`, or Apply flow.
- Files touched:
  - New: `src/assets/agreements/membership-agreement-v2-draft.pdf`, `public/agreements/membership-agreement-v2-draft.pdf`
  - Edit: `src/lib/pdfAssets.ts` (add one mapping)
  - Edit: one admin page to add the preview link (choose SignatureCertificates or Settings)

## Out of scope
- Activating v2, migrating members, sending re-sign requests, drafting Mariam's response.

Confirm and I'll proceed. Want the admin preview link on **Settings** or **Signature Certificates**?