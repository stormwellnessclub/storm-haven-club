# Fix Malak Bazzi's Missing Red-Light Credits

## Diagnosis
- Your +2 red-light adjustment posted successfully on 2026-07-17 at 02:49 AM.
- It attached to `member_credits` row `45560893…` — cycle **6/16/26 – 7/15/26**, which expired 2 days ago.
- No active red-light bucket exists for the current cycle (7/16/26 – 8/15/26) yet, so the credits are invisible in her log/balance.

## Fix
1. **Reverse** the misplaced adjustment on the expired cycle:
   - Update `member_credits` row `45560893…`: `credits_remaining` 3 → 1, `credits_total` 4 → 2 (restores it to its pre-add state so the expired bucket is clean).
   - Insert a `credit_adjustments` "remove 2" entry with reason: *"Reversal — credits re-issued on current cycle 7/16–8/15"*, adjusted_by = you.

2. **Re-issue** the 2 credits on a fresh active cycle:
   - Insert a new `member_credits` row: `credit_type=red_light`, `credits_total=2`, `credits_remaining=2`, `cycle_start=2026-07-16`, `cycle_end=2026-08-15`, `expires_at=2026-08-15 23:59:59 ET`.
   - Insert a `credit_adjustments` "add 2" entry against that new row with reason: *"Manual add 2 red light — re-issued on current cycle (originally posted to expired 6/16–7/15 bucket)"*, adjusted_by = you.

## Result
Malak will show **2 active red-light credits** in her log and balance, expiring 8/15/26. Full audit trail preserved on both cycles.

## Not doing
- Not touching her regular monthly grant — if her plan auto-grants on 7/16, the grant job can still run separately and stack on top.
