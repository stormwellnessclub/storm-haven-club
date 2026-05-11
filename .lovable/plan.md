## Findings

- The issue appears concentrated in the embedded Mother’s Day class pack checkout, not the regular `/class-passes` Stripe Checkout flow.
- Recent Stripe records show several Mother’s Day class pack PaymentIntents stuck in `requires_payment_method` for the same customer, which means Stripe rejected the payment attempt and the form is asking for another method.
- The current implementation creates PaymentIntents with `automatic_payment_methods: { enabled: true }` and confirms them client-side through `PaymentElement`. This can surface wallets/redirect methods or reuse customer state in ways that look like generic “card declined” failures.

## Plan

1. **Tighten the Mother’s Day class pack PaymentIntent setup**
   - Update `supabase/functions/mothers-day-pack-create-intent/index.ts` so this sale uses explicit card-only payment methods for the embedded form.
   - Add safer Stripe key validation/logging without exposing secrets, so if the wrong backend key is ever configured it fails clearly.
   - Preserve the current server-side member/non-member price resolution, fee gross-up formula, metadata, and pending checkout tracking.

2. **Improve customer/payment state handling**
   - Avoid PaymentIntent configuration that can require unsupported redirect flows in the embedded checkout.
   - Keep `receipt_email`, metadata, buyer info, and customer lookup intact.

3. **Improve frontend failure messaging for this sale**
   - Update `src/components/marketing/MothersDayClassPackSection.tsx` so payment failures show the actual Stripe message plus a clear retry path.
   - Make sure the pay button unlocks after declines and the user can enter a different card without restarting the whole purchase.

4. **Verify after implementation**
   - Check the function source for the corrected PaymentIntent configuration.
   - Review recent logs/Stripe signals after the change if a new test attempt is made.

## Out of scope

- I will not change pricing, expiration, membership verification, or regular class pass checkout.
- I will not manually create class passes for failed attempts unless you give me a specific successful PaymentIntent to reconcile.