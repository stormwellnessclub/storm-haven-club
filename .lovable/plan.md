<final-text>
You’re right: the next pass needs to verify the real failures first, not just tweak nearby UI.

What I confirmed from the code:
- The three `Appointments.tsx` gate conditions are already open for completed appointments. So the remaining appointment bug is not those button/show conditions anymore.
- The waiver flow already has the PWA/cache changes. So the remaining waiver bug is likely the actual PDF source/value being used in live data, plus one waiver flow (`Apply.tsx`) still using its own separate download/open logic.
- `SpaCompletionDialog.tsx` is still pre-populating form state by calling `setState` during render. That is brittle and is the strongest code-level suspect for old completed appointments behaving incorrectly.
- `resolvePdfUrl()` currently passes all full URLs through unchanged. If the active waiver record is storing an old preview/build URL, it will keep trying that dead URL and 404 forever.

Plan:
1. Verify the live backend records before changing code
- Check the actual `spa_appointments` rows that are failing, including `status`, `amount_paid`, `payment_method`, `member_id`, `payment_intent_id`, and role/update access.
- Check the active `agreements` rows for `liability_waiver` and inspect the exact `pdf_url` values being served right now.

2. Fix the completed-appointment checkout at the real failure point
- Refactor `src/components/admin/spa/SpaCompletionDialog.tsx` to move all pre-population into a proper `useEffect` keyed to the selected appointment.
- Normalize legacy/old appointment values so older completed rows can still open, edit, tip, and save without bad default state.
- Verify every entry point that opens the checkout dialog still uses the corrected behavior.

3. Fix waiver URL resolution for stale live data
- Update `src/lib/pdfAssets.ts` so known agreement PDFs are resolved by filename even when the database contains old absolute app URLs or legacy paths, instead of blindly passing those URLs through.
- Keep real external/storage URLs working, but stop preserving obviously stale app/build asset links.

4. Patch the remaining waiver UI path
- Update `src/pages/Apply.tsx` so its liability waiver open/download logic uses the same hardened URL handling and response validation as the shared agreement components.
- Keep `SimpleAgreementCard` / `AgreementPDFViewer` aligned so all waiver entry points behave the same.

5. Verify end-to-end before calling it fixed
- Open an older completed appointment and submit a corrected payment/tip successfully.
- Open and download the liability waiver from each member-facing flow that can show it, especially the one currently failing.
- Confirm the browser network request returns the real PDF instead of a 404 page.
</final-text>