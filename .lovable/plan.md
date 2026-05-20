## Problem

The `mothers-day-reconcile` run on May 18 re-created `mothers_day_2026` 10-packs for members who already had one from the original May 8-9 sale. Each duplicate pack still has 10/10 remaining, while the original is in active use.

## Duplicates to delete

These 4 passes (all `pass_type=10-pack`, `promo_code=mothers_day_2026`, created 2026-05-18 22:17, classes_remaining=10) are the redundant copies. Their corresponding originals from May 8-9 remain untouched.

| Member | Original (keep) | Duplicate (delete) |
|---|---|---|
| Rayanne Haidar | 7752b98a — 7 remaining | 878c959e |
| Jenna Saleh | 6ee7d20c — 9 remaining | 4ac88bda |
| Nada Alma | 1b7f9741 — 6 remaining | 920a4fc2 |
| Nahla Hammoud | 8601e755 — 8 remaining | 6b1541f5 |

**Ayana silmi's** May 18 pack (78f95ab0) is kept — she had no prior mothers_day_2026 pack, this was the legitimate fix that started the whole thing. Souad and Fatima Naji's duplicates were already cleaned up manually.

## Steps

1. `DELETE FROM class_passes WHERE id IN (...4 ids above)` via insert tool.
2. Patch `supabase/functions/mothers-day-reconcile/index.ts` to skip any member who already has a `class_passes` row with `promo_code='mothers_day_2026'`, regardless of `stripe_payment_intent_id` linkage — prevents the same regression if reconcile is ever re-run.

No schema change, no UI change.
