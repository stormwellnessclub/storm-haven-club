

# Super Admin: Edit Expiration Dates on Guest Passes + Universal Add/Edit

## Problem
1. **Guest passes** have no way to edit `expires_at` — only `valid_date` is editable in the GuestDetailSheet
2. You want super admins to be able to adjust expiration dates on **everything** (guest passes, class passes, wellness credits)
3. You also want the ability to **add** any type of credit/pass manually as a super admin

## Current State
- **Class passes**: `EditClassPassDialog` exists with exp date editing (super admin only) -- working
- **Wellness credits**: `EditCreditDialog` exists with exp date editing (super admin only) -- working
- **Guest passes**: `GuestDetailSheet` only allows editing `valid_date`, NOT `expires_at` -- **missing**

## Plan

### 1. Add expiration date editing to GuestDetailSheet
In `src/components/admin/GuestDetailSheet.tsx`, add an editable `expires_at` field (same inline edit pattern as `valid_date`) gated behind `isSuperAdmin()`. This lets super admins change when a guest pass expires.

### 2. Add status editing to GuestDetailSheet
Allow super admins to change guest pass status (active/exhausted/expired) so they can reactivate expired complimentary passes.

### 3. Create `AdminGrantPassDialog` component
New file: `src/components/admin/AdminGrantPassDialog.tsx`

A super-admin-only dialog to manually create any type of pass/credit for any user:
- **Type selector**: Guest Pass, Class Pass, Wellness Credit (Red Light, Dry Cryo)
- **Recipient**: Search by name/email (members and non-members)
- **Details**: Quantity/count, expiration date, notes
- Inserts directly into the appropriate table (`guest_passes`, `class_passes`, or `member_credits`)

### 4. Add "Grant Pass/Credit" button to admin pages
Add a button (super admin only) in:
- `GuestPasses.tsx` — to manually create guest passes without Stripe
- `MemberDetail.tsx` — to add any pass/credit to a member
- `NonMemberDetail.tsx` — to add any pass/credit to a non-member

## Files
- **Modify**: `src/components/admin/GuestDetailSheet.tsx` — add expires_at editing + status change for super admins
- **Create**: `src/components/admin/AdminGrantPassDialog.tsx` — universal pass/credit granting dialog
- **Modify**: `src/pages/admin/GuestPasses.tsx` — add manual grant button
- **Modify**: `src/pages/admin/MemberDetail.tsx` — add grant button
- **Modify**: `src/pages/admin/NonMemberDetail.tsx` — add grant button

