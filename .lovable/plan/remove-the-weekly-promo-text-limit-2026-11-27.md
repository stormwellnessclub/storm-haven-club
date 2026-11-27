# Remove the weekly promo text limit

Owner choice: no limit on how often a person can get club promo texts. The owner decides each send.

## What changes
- Remove the "one promo text per 7 days per person" skip from Campaign Studio sends.
- Keep: one link per text, wording warnings, slower sending pace (~300/hour), small first send after a quiet spell, opt-out/STOP blocking, carrier-blocked count in Results.

## Technical details
- `campaign-studio/index.ts`: drop the lastPromo lookup and `inPromoCooldown` check.
- `_shared/smsPromoRules.ts` + test: remove cooldown helper and its tests.
- `supabase/functions/AGENTS.md`: update the promo text rule (no frequency cap, owner's choice).
- Redeploy campaign-studio.
