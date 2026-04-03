

# Fix: Auto-select correct guest pass type for members

## Problem
When granting a complimentary guest pass to a member, staff can accidentally select "Guest Pass (Voucher)" instead of "Guest Pass Credit (Member Perk)." The voucher option inserts into `guest_passes` with the member's own name — which is wrong. The credit option (inserting into `member_credits`) is what members actually see and can redeem on their app.

## Fix

### File: `src/components/admin/AdminGrantPassDialog.tsx`

1. **Default to "Guest Pass Credit" when opened for a member**: When `prefill` has a `memberId`, set the initial `grantType` to `"guest_pass_credit"` instead of `"guest_pass"`.

2. **Add a warning on the voucher option when targeting a member**: If staff still selects "Guest Pass (Voucher)" while granting to a member, show a small warning like: *"Vouchers are for direct guest entries — use Guest Pass Credit so the member can see and redeem it in their app."*

3. **Rename labels for clarity**:
   - "Guest Pass (Voucher)" → "Guest Pass Voucher (non-member / walk-in)"
   - "Guest Pass Credit (Member Perk)" → "Guest Pass Credit (member can redeem in app)"

4. **Update `resetForm`**: Use `"guest_pass_credit"` as default when `prefill?.memberId` exists.

This is a single-file change to `AdminGrantPassDialog.tsx`. No database changes needed since you already cleaned up Layal's data.

