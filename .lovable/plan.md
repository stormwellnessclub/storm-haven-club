## Goal

When approving / activating a member, the "Activate Member" dialog should clearly show the processing fee being added on top of the initiation fee and (for founding members) the annual subscription — so you can see the exact total before clicking Activate.

Today the dialog only has two checkboxes ("Charge initiation fee" / "Create subscription") with no dollar amounts. The fee IS being charged correctly by the backend; it just isn't visible in the UI.

## Changes — frontend only

### 1. `src/components/admin/SingleActivationDialog.tsx`

Add a single "Charge summary" panel that appears whenever either checkbox is active and there's a card on file. It dynamically reflects the toggles.

For each enabled line item, render: `Base $X.XX + Processing fee $Y.YY = Total $Z.ZZ`, then a final grand total at the bottom.

Lines shown:
- **Initiation fee** (when "Charge initiation fee" checked): base from `getInitiationFee(gender)` — $300 women / $175 men.
- **First annual payment** (when "Create dues subscription" checked AND founding member): base from `getAnnualPrice(tier, gender)` — e.g. $2,400 for Silver woman.
- **First monthly payment** (when "Create dues subscription" checked AND not founding): base from `getMonthlyPrice(tier, gender)`.

Note for the subscription line: "First charge runs on {startDate}; processing fee recurs each cycle."

All math uses existing `calculateProcessingFeeFromDollars()` from `src/lib/processingFee.ts`. Pull tier/gender helpers from `src/lib/membershipPricing.ts` (already imports clean — `extractTier`, `normalizeGender`, `getInitiationFee`, `getMonthlyPrice`, `getAnnualPrice`).

Dialog props get two extras passed through from `Applications.tsx`: `membership_plan` and `gender` (already on the `application` object — just widen `Application` interface here).

### 2. `src/pages/admin/Applications.tsx` — small follow-on so the receipt matches

In `handleSingleActivation` (line ~932) and `handleChargeApplicationCard` (line ~1088), the success toast and `charge_confirmation` email currently report only the base amount ($300.00). Update them to report the **total actually charged** (base + processing fee, computed with `calculateProcessingFeeFromDollars`) and add a "(includes $X.XX processing fee)" note. This matches what Stripe charges and what the customer sees on their statement.

## Out of scope

- No backend / edge-function changes. `charge_saved_card` and `admin_create_member_subscription` already gross up the fee correctly.
- Not changing the hardcoded $300 initiation amount in `Applications.tsx` (separate issue — men's fee is actually $175). Flag only; do not fix here unless you ask.
- No DB or schema changes.

## Files touched

- `src/components/admin/SingleActivationDialog.tsx` — add charge-summary panel, widen `Application` type.
- `src/pages/admin/Applications.tsx` — include processing fee in toast + `charge_confirmation` email payload (two call sites).
