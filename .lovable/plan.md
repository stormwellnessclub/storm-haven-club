

## Add Super Admin Class Pass Management

### What You'll Get

An "Edit Pass" button on every class pass card (in both Member Detail and Non-Member Detail admin pages) that opens a dialog where super admins can:

- **Change status** -- Deactivate, reactivate, or mark as expired/exhausted
- **Edit expiration date** -- Push it forward or back
- **Edit purchased date** -- Correct the original purchase date
- **Adjust remaining classes** -- Set to any number (0 to total)
- **Delete the pass entirely** -- With confirmation

This will be restricted to **super_admin** role only.

---

### Implementation

**1. New Component: `src/components/admin/EditClassPassDialog.tsx`**

A dialog with:
- Status dropdown (active, expired, exhausted, refunded)
- Expiration date picker
- Purchased date picker  
- Classes remaining number input (capped at classes_total)
- Save button that updates the `class_passes` row
- Delete button with a confirmation step
- All changes logged via toast notifications

**2. Update `src/pages/admin/MemberDetail.tsx` (Credits tab, lines 1880-1905)**

Add an "Edit" icon button on each class pass card (visible only to super admins). Clicking opens the `EditClassPassDialog` with the pass data pre-filled.

**3. Update `src/pages/admin/NonMemberDetail.tsx`**

Same edit button on each pass card in the non-member detail view, also restricted to super admins.

### Technical Details

- **Mutation**: Direct `supabase.from("class_passes").update(...)` for edits, `.delete()` for removal
- **Role check**: Uses existing `useUserRoles()` hook -- `isSuperAdmin()` gate on the edit button
- **Query invalidation**: Invalidates `member-class-passes-admin` and `admin-nonmember-passes` queries after save/delete
- **No database changes needed** -- all columns already exist and are updatable
