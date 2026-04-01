

# Unify Class Passes as "Class Pass"

## Summary
Merge the two class pass categories into one **"Class Pass"** at the Pilates/Cycling price ($25/$30 single, $170/$285 10-pack). Processing fees already pass through to customers — no change needed there. Legacy passes continue working with directional upgrade logic.

## Processing Fee Status
**Already handled correctly.** The `create_class_pass_checkout` action (line 628-632 in stripe-payment) already adds a processing fee line item via `createProcessingFeeLineItem()`. The customer pays the fee, not you. No changes needed here.

## Legacy Pass Safety
- Existing `aerobics` passes stay in the DB with category `aerobics` — they can only be used for "other" classes (lower price respected)
- Existing `pilates_cycling` passes get upgraded: they can now be used for ALL classes (fair, since they paid more)
- The old "Other Classes" Stripe price IDs remain in the webhook `PRICE_ID_MAP`, so if anyone completes an old checkout link, it still creates the correct `aerobics`-category pass
- No data migration needed — this is purely a mapping + UI change

## Changes

### 1. Category mapping (`src/lib/classCategories.ts`)
- Add `'pilates_cycling'` to `CLASS_TO_PASS_MAPPING['other']` so pilates_cycling passes work for all class types
- Update `CATEGORY_DISPLAY_NAMES['pilates_cycling']` → **"Class Pass"**

### 2. Purchase UI (`src/pages/ClassPasses.tsx`)
- Remove `otherClassesPricing` array and the "Other Classes" section
- Rename `pilatesCyclingPricing` → `classPassPricing`
- Update heading to **"Class Pass"** with subtitle "Valid for all studio classes"
- All purchases route through `category: 'pilatesCycling'` (same Stripe price IDs, same processing fee logic)
- Update hero description text

### 3. Webhook labels (`supabase/functions/stripe-webhook/index.ts`)
- Update `PRICE_ID_MAP` labels from "Pilates/Cycling" to **"Class Pass"** for the 4 pilates_cycling price entries
- Keep the 4 "Other Classes" price entries unchanged (handles legacy purchases)

### 4. Admin import labels (`src/components/admin/NonMemberStripeImport.tsx`)
- Rename "Pilates/Cycling" labels to **"Class Pass"** in `KNOWN_PRICE_IDS`

### Files changed
- `src/lib/classCategories.ts`
- `src/pages/ClassPasses.tsx`
- `src/components/admin/NonMemberStripeImport.tsx`
- `supabase/functions/stripe-webhook/index.ts`

