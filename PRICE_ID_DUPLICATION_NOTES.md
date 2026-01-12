# Price ID Duplication Documentation

## Current Situation

Price IDs are duplicated between:
- `src/lib/stripeProducts.ts` (frontend - Node.js/TypeScript)
- `supabase/functions/stripe-payment/index.ts` (Edge Function - Deno)
- Potentially `supabase/functions/stripe-webhook/index.ts` (if it uses price IDs)

## Why Duplication Exists

Edge Functions run in **Deno**, while the frontend runs in **Node.js/TypeScript**. They cannot directly import TypeScript files from the frontend codebase. This is a technical limitation, not a design choice.

## Solution: Documentation

Clear comments have been added to both files:
1. `src/lib/stripeProducts.ts` - Marked as source of truth
2. `supabase/functions/stripe-payment/index.ts` - Documents duplication and update process

## Update Process

When adding or updating Stripe price IDs:

1. **Update `src/lib/stripeProducts.ts`** (source of truth)
2. **Update `supabase/functions/stripe-payment/index.ts`** to match
3. **Check `supabase/functions/stripe-webhook/index.ts`** if it uses price IDs

## Future Improvement Options

1. **Create shared JSON file** - Both could import from a JSON file
2. **Environment variables** - Store price IDs in Supabase environment (not ideal for many prices)
3. **Accept duplication** - Current approach with clear documentation (recommended)

## Recommendation

**Keep the duplication** with clear documentation. The overhead of maintaining two locations is minimal compared to the complexity of trying to share code between Deno and Node.js environments.
