

# Referral Rewards Update

## Changes to Reward Point Costs

Update the `REWARDS` array in `src/pages/member/Referrals.tsx`:

| Reward | Current | New |
|--------|---------|-----|
| Red Light Therapy Session | 300 pts | 1,000 pts |
| Dry Cryo Session | 400 pts | 500 pts |
| 1 Class Credit | 250 pts | 1,000 pts |
| 1 Guest Pass | 200 pts | 500 pts |
| Cafe Credit ($10) | 500 pts | 500 pts (no change) |
| Spa Service Discount (20%) | 750 pts | **REMOVED** |

The minimum redeemable reward is now 500 points, meaning a member needs at least 1 successful referral (which earns 500 pts) before they can redeem anything.

## Files Modified

- **`src/pages/member/Referrals.tsx`** -- Update the `REWARDS` array with new point values and remove the spa discount entry.
- **Database migration** -- Update the `redeem_referral_points` function to reflect the new point costs and remove the `spa_discount` case.

No other logic changes needed -- the existing balance check (`pointsBalance >= reward.points`) already prevents redemption if they don't have enough points.

