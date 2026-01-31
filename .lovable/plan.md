
# Plan: Add Delete Application Functionality

## Overview
Add the ability for administrators to permanently delete membership applications from the Applications admin page. This feature will include a confirmation dialog to prevent accidental deletions.

## Technical Approach

### 1. Database: Add DELETE RLS Policy
Create a new RLS policy on the `membership_applications` table to allow deletion by authorized staff roles (super_admin, admin, manager).

```sql
CREATE POLICY "Staff can delete applications"
  ON public.membership_applications
  FOR DELETE
  TO public
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));
```

### 2. Component State for Delete Confirmation
Add state variables to manage the delete confirmation dialog:
- `showDeleteDialog`: Controls visibility of the confirmation dialog
- `applicationToDelete`: Stores the application being deleted
- `isDeleting`: Loading state during deletion

### 3. Delete Mutation
Create a new React Query mutation that:
- Calls Supabase to delete the application by ID
- Invalidates the applications query cache on success
- Shows success/error toast notifications

### 4. UI Components

**Dropdown Menu Item**
Add a "Delete" option to the actions dropdown for each application (with red/destructive styling):
```text
┌─────────────────────────┐
│ View Details            │
│ Charge Card             │
│ Add Payment Method      │
│ ─────────────────────── │
│ Approve & Send Email    │
│ Reject                  │
│ Cancel                  │
│ ─────────────────────── │
│ 🗑️ Delete (destructive) │
└─────────────────────────┘
```

**Confirmation Dialog**
A AlertDialog that warns the user before deletion:
```text
┌─────────────────────────────────────────┐
│ Delete Application                       │
│                                         │
│ ⚠️ This will permanently delete the     │
│ application for [Applicant Name].       │
│                                         │
│ This action cannot be undone. The       │
│ following related data will also be     │
│ deleted:                                │
│ • Application status history            │
│ • Associated charge records             │
│                                         │
│            [Cancel]  [Delete]           │
└─────────────────────────────────────────┘
```

## Files to be Modified

| File | Changes |
|------|---------|
| `supabase/migrations/[new]` | Add DELETE RLS policy for membership_applications |
| `src/pages/admin/Applications.tsx` | Add delete state, mutation, dialog, and dropdown menu item |

## Implementation Details

### State Variables (Applications.tsx)
```typescript
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
```

### Delete Mutation (Applications.tsx)
```typescript
const deleteApplicationMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from("membership_applications")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
    toast.success("Application deleted");
    setShowDeleteDialog(false);
    setApplicationToDelete(null);
  },
  onError: () => {
    toast.error("Failed to delete application");
  },
});
```

### New Dropdown Menu Item
```jsx
<DropdownMenuSeparator />
<DropdownMenuItem 
  className="text-destructive focus:text-destructive"
  onClick={() => {
    setApplicationToDelete(app);
    setShowDeleteDialog(true);
  }}
>
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</DropdownMenuItem>
```

## Security Considerations
- Only `super_admin`, `admin`, and `manager` roles can delete applications (enforced via RLS)
- Related `application_status_history` records are automatically deleted via CASCADE constraint
- Confirmation dialog prevents accidental deletions

## Data Cascade
When an application is deleted, the following happens automatically:
- `application_status_history` records are deleted (ON DELETE CASCADE already configured)

Note: If there's an associated member record (for approved applications), it will **not** be deleted - only the application itself.
