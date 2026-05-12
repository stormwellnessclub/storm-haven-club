## Problem

On the admin Member Detail page, clicking the X to remove a member note fails with an "invalid" error. The note is never deleted.

## Root cause

`useDeleteMemberNote` (in `src/hooks/useMemberNotes.ts`) expects an object argument:

```ts
mutationFn: async ({ id, memberId }) => { ... .eq("id", id) ... }
```

But `src/pages/admin/MemberDetail.tsx` (line 3027) calls it with a raw string:

```tsx
onClick={() => deleteNote.mutate(note.id)}
```

The string gets destructured, so both `id` and `memberId` become `undefined`. The delete request then hits PostgREST as `?id=eq.undefined`, which returns the "invalid input syntax for type uuid" error → toast shows "invalid".

(The other usage in `src/components/admin/MemberDetailSheet.tsx` already passes the correct shape and works fine.)

## Fix

In `src/pages/admin/MemberDetail.tsx`, update the delete click handler to pass the expected object, and add a confirmation prompt to match the sheet's behavior:

```tsx
onClick={() => {
  if (confirm("Delete this note?")) {
    deleteNote.mutate({ id: note.id, memberId });
  }
}}
```

Also disable the button while the mutation is pending (`disabled={deleteNote.isPending}`) to avoid double-clicks.

## Out of scope

- No RLS / database changes (existing policies already allow super_admin, admin, manager to delete).
- No changes to the sheet variant — it already works correctly.
