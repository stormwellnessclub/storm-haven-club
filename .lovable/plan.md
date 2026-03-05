

# Super Admin: Edit Expiration Dates on All Passes & Credits

## Current State
- **Class passes** already have `EditClassPassDialog` with full editing (status, expiration, classes remaining, delete) — gated to `isSuperAdmin()`. This already works.
- **Wellness credits** (`member_credits` — Red Light, Dry Cryo, Class, Guest Pass) have **no edit dialog**. Admins can grant credits and adjust remaining counts, but cannot change expiration dates or other fields.

## Plan

### 1. Create `EditCreditDialog` component
New file: `src/components/admin/EditCreditDialog.tsx`

A dialog similar to `EditClassPassDialog` but for `member_credits` rows. Fields:
- **Credit type** (read-only display)
- **Credits remaining** (editable, max = credits_total)
- **Expiration date** (calendar picker — the main ask)
- **Cycle start / Cycle end** (calendar pickers)
- Delete option with confirmation

Updates `member_credits` table via supabase. Super admin only.

### 2. Add edit buttons in MemberDetail credits section
In `src/pages/admin/MemberDetail.tsx`, wherever credits are displayed (the Credits tab), add a pencil icon button gated behind `isSuperAdmin()` that opens `EditCreditDialog`.

### 3. Add edit buttons in NonMemberDetail credits section
In `src/pages/admin/NonMemberDetail.tsx`, same treatment for the non-member wellness credits section.

### 4. Add edit buttons in MemberCredits page
In `src/pages/admin/MemberCredits.tsx` (the dedicated credits management page), add pencil edit buttons for each credit row.

## No database changes needed
All fields (`expires_at`, `cycle_start`, `cycle_end`, `credits_remaining`) already exist and are updatable.

## Files
- **Create**: `src/components/admin/EditCreditDialog.tsx`
- **Modify**: `src/pages/admin/MemberDetail.tsx`, `src/pages/admin/NonMemberDetail.tsx`, `src/pages/admin/MemberCredits.tsx` — add edit buttons + dialog integration

