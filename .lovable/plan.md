

## Add Guest Pass Credit Management for Super Admins

### Problem
Guest pass credits (`guest_pass` type) are completely missing from the credit management UI -- both the Member Credits page and the Member Detail page only show class, red light, and dry cryo credits. There's no way to give an individual member a guest pass credit unless you use the mass email tool.

### Solution
Add `guest_pass` as a selectable credit type everywhere credits are managed, and handle the case where no existing guest pass credit row exists by creating one on the fly.

### Changes

**1. `src/pages/admin/MemberCredits.tsx`** (3 spots)
- Add `guest_pass` option to the **filter dropdown** (line ~467)
- Add `guest_pass` option to the **adjust dialog credit type selector** (line ~938)
- Add a **Guest Pass column** to the credits table (after Dry Cryo, line ~534-559)
- Update the adjust mutation to **create a new credit row** if no existing guest_pass credit exists (instead of throwing an error)

**2. `src/pages/admin/MemberDetail.tsx`** (2 spots)
- Add `guest_pass` option to the **adjust credit dialog** selector (line ~1918-1921)
- Update the adjust mutation to **create a new credit row** when adding guest_pass credits and none exist yet (line ~405-409)

### How the "create if missing" logic works
When a super admin adds guest pass credits and no `member_credits` row exists for `guest_pass`:
- Insert a new row into `member_credits` with `credit_type: 'guest_pass'`, `credits_total` and `credits_remaining` set to the requested amount, cycle dates covering the current month, and expiry at end of month
- Log the adjustment in `credit_adjustments` as usual
- This is only needed for `guest_pass` since the other credit types are auto-created on membership activation

### No database changes needed
The `guest_pass` value already exists in the `credit_type` enum. The member portal already renders the guest pass card when a credit exists.
