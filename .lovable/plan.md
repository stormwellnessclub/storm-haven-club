

# Unify Class Passes as "Class Pass"

## Status: ✅ Implemented

## Summary
Merged the two class pass categories (Pilates/Cycling and Other) into one **"Class Pass"** at the Pilates/Cycling price ($25/$30 single, $170/$285 10-pack). Processing fees already pass through to customers. Legacy passes honored with directional upgrade logic.

## Legacy Pass Rules
- **pilates_cycling passes** → valid for ALL classes (upgraded)
- **aerobics passes** → still restricted to "other" classes only (lower price respected)
- Old "Other Classes" Stripe price IDs remain in webhook for legacy checkout links

## Changes Made
- `src/lib/classCategories.ts` — added `pilates_cycling` to `CLASS_TO_PASS_MAPPING['other']`, renamed display to "Class Pass"
- `src/pages/ClassPasses.tsx` — merged to single "Class Pass" pricing table, removed "Other Classes" section
- `src/components/admin/NonMemberStripeImport.tsx` — renamed labels to "Class Pass", legacy entries marked [Legacy]
- `supabase/functions/stripe-webhook/index.ts` — updated labels to "Class Pass"
