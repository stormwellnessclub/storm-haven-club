

# Add Admin Kids Care Pass Management

## What's missing
The admin Childcare page has no visibility into Kids Care passes. Staff cannot:
- See which parents have purchased Kids Care passes
- Subtract credits from a pass (e.g., if a child used a session but wasn't properly tracked)
- Charge a parent for a new Kids Care pass
- Backdate a pass purchase date (e.g., for a retroactive charge)
- Grant a pass manually without payment

Kids Care passes are stored in the `class_passes` table (with `pass_type` containing "kids" or "care"). The existing `EditClassPassDialog` already supports editing `classes_remaining`, `purchased_at` (backdating), `expires_at`, and status. The `AdminGrantPassDialog` can grant passes but doesn't have a "kids_care" grant type. The `ChargeItemSelector` can charge cards but doesn't have a Kids Care pass product option.

## Plan

### 1. Add a "Passes" tab to the admin Childcare page
- New tab in `src/pages/admin/Childcare.tsx` labeled "Passes"
- Search by parent name/email to find their Kids Care passes
- Query `class_passes` where `pass_type` matches kids/care patterns
- Show each pass with: status, sessions remaining/total, purchase date, expiry, parent name
- Click a pass to open `EditClassPassDialog` (already supports subtract credits, backdate, delete)

### 2. Add "Kids Care Pass" as a grant type in AdminGrantPassDialog
- Add `"kids_care_pass"` to the `GrantType` union in `src/components/admin/AdminGrantPassDialog.tsx`
- When selected, insert into `class_passes` with `pass_type: "kids_care_monthly"`, `category: "other"`, `classes_total: 16`, `classes_remaining: 16`
- Allow setting a custom `purchased_at` date (backdate support) — the dialog already has a date picker for expiry, add one for purchase date
- Allow setting custom session count

### 3. Add "Charge for Kids Care Pass" action
- Add a "Charge Parent" button in the Passes tab that opens `ChargeItemSelector` pre-filled with the parent's info
- Ensure the Kids Care Monthly Pass ($75) and Single Session ($40) appear as chargeable items in `ChargeItemSelector` if not already present

### 4. Show pass info on booking cards (from the previous approved plan)
- Update the `get_admin_kids_care_bookings` RPC to LEFT JOIN `class_passes` on `b.pass_id` and return pass fields
- Show pass status and remaining sessions on each booking card in the admin view
- Fix the child profile name-match to use case-insensitive trimmed comparison

## Files to change
- `src/pages/admin/Childcare.tsx` — add Passes tab with parent search and pass list
- `src/components/admin/AdminGrantPassDialog.tsx` — add kids_care_pass grant type with backdate support
- `src/hooks/useAdminKidsCareBookings.ts` — add pass fields to interface
- Database migration — update `get_admin_kids_care_bookings` RPC to join pass data and fix name matching

