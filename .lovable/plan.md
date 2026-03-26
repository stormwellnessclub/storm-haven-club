

# Show Guest Pass Vouchers in Member Detail

## Problem
When you grant a "Guest Pass (Voucher)" from a member's account, it inserts into the `guest_passes` table. But the Member Detail page only displays data from `member_credits` (which is where "Guest Pass Credit (Member Perk)" goes). So voucher-type guest passes are invisible in the member view.

## Solution
Add a "Guest Pass Vouchers" section to the member detail page that queries the `guest_passes` table filtered by `user_id`, showing any vouchers linked to that member.

### File: `src/pages/admin/MemberDetail.tsx`
1. **Add a query** for `guest_passes` where `user_id = member.user_id`, ordered by `purchased_at DESC`
2. **Add a visual section** (below the existing credits grid or in the wellness tab) showing each guest pass voucher with:
   - Status badge (active / used / expired)
   - Expiration date
   - Guest name (if filled)
   - Notes/referral source
3. Keep it compact — a small card or table rows, consistent with the existing credit cards style

This way, when you grant a guest pass voucher to a member, it will immediately appear in their member detail view.

