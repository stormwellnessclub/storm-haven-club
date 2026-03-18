
Fix the immediate-activation application card flow by replacing the fragile inline card form on `src/pages/Apply.tsx` with the same hardened Stripe form pattern already used elsewhere.

What I found
- The public application page does create a setup intent successfully via `create_application_setup`.
- The blank area is most likely in the frontend rendering path, not Stripe itself.
- `Apply.tsx` currently uses a lightweight inline `PaymentElement` inside the main application `<form>`, with minimal load/error handling.
- A more robust version already exists in `src/components/PaymentSectionEnhanced.tsx` and in the admin add-card modal:
  - explicit loading overlay
  - `onLoadError` handling
  - `elements.submit()` before confirm
  - stronger success validation
  - retry path when card details sync lags
- `StripeProvider` is also mounted without a changing `key` in `Apply.tsx`, so reopening/retrying can leave stale Stripe state around.

Implementation plan
1. Replace the current `InlinePaymentFormInner` usage in `Apply.tsx`
- Remove the fragile inline form path from the application page.
- Reuse the hardened payment form UX from `PaymentSectionEnhanced` for applicant card capture.
- Ensure the embedded card form is rendered outside any problematic nested-form behavior.

2. Harden the Stripe mount lifecycle on the application page
- Add a setup-intent instance key so each new client secret forces a fresh `StripeProvider`/`Elements` mount.
- Reset that key when applicants cancel/reopen Add Payment Method.
- Keep the current `create_application_setup` backend action.

3. Improve visible error handling so “blank” never happens silently
- Add loading, form-init, and `PaymentElement` load-error states directly in the applicant flow.
- Surface a clear fallback message if Stripe config or element loading fails.
- Keep the user-facing “No charge will be made now” copy.

4. Make immediate activation behavior stricter
- If “activate immediately” is selected, require either:
  - saved card on file, or
  - explicitly uncheck the add-card option and block submission with a clear message.
- Update progress/validation messaging so this requirement is obvious before submit.

5. Preserve successful save behavior
- On success, continue storing:
  - `stripe_customer_id`
  - `payment_info_provided`
  - card brand/last4/expiry when available
- Keep webhook-based backup sync intact.

Files to update
- `src/pages/Apply.tsx`
  - replace inline payment form path
  - add remount key + stronger UI state handling
  - tighten immediate-activation validation
- `src/components/PaymentSectionEnhanced.tsx`
  - likely extract/reuse inner applicant-safe payment form logic
- Possibly a small shared component if reuse is cleaner than copying logic

Expected outcome
- “Add Payment Method” on the membership application will reliably open a real Stripe card form instead of a blank area.
- Immediate-activation applicants will be able to save a card and submit confidently.
- If Stripe fails to load, they will see a specific error with retry instead of silent failure.

Technical notes
- Backend appears present and configured:
  - `stripe-payment` has `create_application_setup`
  - publishable key secret exists
  - `stripe-config` edge function exists
- The main problem appears to be UI flow robustness in `Apply.tsx`, not missing Stripe connection.
- I would not change billing logic first; I would align the application page with the already-working card setup pattern used in the admin/self-service flows.

<lov-actions>
<lov-suggestion message="Test the membership application end-to-end, including Add Payment Method and immediate activation, to verify the Stripe form loads and saves correctly">Verify that it works</lov-suggestion>
<lov-suggestion message="Implement the fix now by replacing the fragile application card form with the hardened Stripe payment form pattern used elsewhere in the app">Fix applicant payment form</lov-suggestion>
<lov-suggestion message="Add a required validation that immediate-activation applicants must have a saved card on file before submission">Require card for immediate activation</lov-suggestion>
<lov-suggestion message="Add detailed applicant payment diagnostics and visible retry messaging so Stripe loading failures are easier to catch before losing applications">Improve payment error handling</lov-suggestion>
</lov-actions>
