

## Fix: Guest Pass Credits Showing Zero After Admin Grants Them

### Root Cause
The `AdminGrantPassDialog` has a type called `"guest_pass"` that inserts rows into the **`guest_passes`** table (individual day-pass vouchers for guests). But the member portal's "complimentary guest pass credit" feature reads from the **`member_credits`** table with `credit_type = 'guest_pass'`. These are two entirely different systems — so when you grant a "Guest Pass" from the member detail page, the credit never appears in the member's portal.

### Fix

**File: `src/components/admin/AdminGrantPassDialog.tsx`**

Add a new grant type `"guest_pass_credit"` (Member Guest Pass Credit) that inserts into `member_credits` with `credit_type: 'guest_pass'` — the same table/type the member portal actually reads from. This follows the exact same pattern as the existing `red_light` and `dry_cryo` credit grants.

Changes:
- Add `"guest_pass_credit"` to the `GrantType` union and `typeLabel` map (label: "Guest Pass Credit (Member Perk)")
- Include it in `availableTypes` when a `userId` is present
- In the mutation, handle it just like `red_light`/`dry_cryo`: insert into `member_credits` with `credit_type: 'guest_pass'`, using the member's `memberId` and `userId`, with the specified quantity and expiration
- Keep the existing `"guest_pass"` type as-is for granting standalone guest day passes (the voucher system)

### Result
When you select "Guest Pass Credit (Member Perk)" and grant it to a member, it will insert into `member_credits` where the member portal actually looks — so credits will appear immediately.

### Files to modify
- `src/components/admin/AdminGrantPassDialog.tsx` — add new `guest_pass_credit` grant type

