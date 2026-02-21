

## Add Non-Member Portal Link to Admin Sidebar

### Change

Add a new menu item to the **Management** section of the admin sidebar (`src/components/admin/AdminSidebar.tsx`):

- **Label**: "Non-Member Portal"
- **URL**: `/portal`
- **Icon**: `Users` (or `UserPlus` for distinction)
- **Required Roles**: `super_admin`, `admin`, `manager`, `front_desk`

### Technical Details

**File: `src/components/admin/AdminSidebar.tsx`**

- Add a new entry to the `managementItems` array:
  ```ts
  { title: "Non-Member Portal", url: "/portal", icon: UserPlus, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] }
  ```
- Import `UserPlus` from `lucide-react`
- Add `/portal` to `PAGE_PERMISSIONS` in `src/lib/permissions.ts` with the same roles so the `canAccessPage` filter passes

Two files modified, no backend changes.

