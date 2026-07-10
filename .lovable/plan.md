## Fix admin instructor delete + staff permissions edit

### 1. Instructor delete (`src/pages/admin/Instructors.tsx`)
The page only exposes an edit (pencil) button. Add a trash icon next to it that opens an AlertDialog "Delete instructor?" confirming, then:
- Try hard delete: `supabase.from('instructors').delete().eq('id', instructor.id)`.
- If the delete fails because of a foreign-key reference (past sessions/schedules still link to them), fall back to a soft-deactivate: `update({ is_active: false })` and toast "Instructor has past sessions — deactivated instead of deleted." That keeps historical rosters intact.
- Refresh the list after either path.

### 2. Staff permissions row not clickable (`src/pages/admin/StaffRoles.tsx`)
Currently the whole `<TableRow>` uses `onClick={() => navigate(...)}`. That's fragile (some browsers/touch inputs don't fire, and there's no visible affordance). Fix by:
- Adding an explicit "Edit" action column with a `Pencil` button that calls `navigate(\`/admin/staff-roles/${staff.userId}\`)` and `e.stopPropagation()`.
- Keeping the row click as a convenience, but also making the name cell a proper link-styled button so keyboard/tap users have a real target.

No DB or RLS changes needed — the `/admin/staff-roles/:userId` route and `StaffDetail` page already exist.

### Technical details
- Import `Trash2` and `AlertDialog*` primitives in `Instructors.tsx`.
- Add local state `deletingId` to drive the confirm dialog.
- In `StaffRoles.tsx`, add a `<TableHead className="text-right">Actions</TableHead>` and matching cell with the edit button; leave the placeholders tab unchanged.
