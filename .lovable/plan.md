I’ll fix the purchase path directly so guest passes and class passes do the three required things: collect information, take payment, and require waiver/agreement signing.

Plan:

1. **Remove the confusing account messaging I added**
   - Stop pushing “returning visitors” toward reset-password language on guest/class pass purchase screens.
   - Keep the simple requirement: sign in or create an account to purchase.
   - Fix any reset links that currently point to the wrong place.

2. **Fix Stripe return URLs for guest pass and class pass checkout**
   - The current code can create a bad URL with two question marks, like `?purchase=success?session_id=...`.
   - Update checkout creation so `session_id` is appended correctly whether the URL already has query parameters or not.
   - Make class pass return reliably run the confirmation/reconcile step.

3. **Harden class pass purchase completion**
   - Keep the existing required liability waiver + class pass agreement gate before payment.
   - After payment, confirm the checkout session, reconcile if the webhook is delayed, refresh active passes, and show success only after the paid session is verified.
   - Preserve idempotency so refreshes/webhook retries do not double-create class passes.

4. **Harden guest pass purchase completion**
   - Keep required liability waiver + guest pass agreement before the form.
   - Keep required guest information validation: name, email, phone, sex, visit date, and visit interests.
   - After payment return, verify/reconcile the checkout instead of only showing a generic success state.
   - Ensure the paid guest pass record includes guest info, visit date, phone, add-ons, Stripe payment/customer IDs, and any class add-on pass records.

5. **Add backend safeguards where needed**
   - Use the existing payment function/webhook patterns.
   - Treat duplicate fulfillment as success, not failure.
   - Avoid leaving successful payments without a guest pass/class pass if webhook delivery is delayed.

6. **Validate the flow**
   - Check the updated code paths for guest pass checkout, class pass checkout, waiver signing, and return handling.
   - Confirm the return URL parsing and session confirmation logic are consistent for both purchases.