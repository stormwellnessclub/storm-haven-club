
## Problem

`ProtectedPortalRoute` currently only checks the `members` table. If an admin user visits `/portal`, they are not found in `members` (or are redirected to `/member` if they happen to have a member record), meaning they cannot view the non-member portal at all.

The fix: also query `user_roles` for any staff role. If the user has at least one role, allow them through the portal gate without redirecting.

## Technical Change

**File:** `src/components/portal/ProtectedPortalRoute.tsx`

Add a parallel check alongside the membership check:

```ts
// Check if user has any staff/admin role
const { data: roleData } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .limit(1)
  .maybeSingle();

const isStaff = !!roleData;
```

Logic update:
- If `isStaff` is true → allow through (do not redirect to `/member` even if they have a member record)
- If `isMember` is true AND NOT staff → redirect to `/member` as before
- If neither → redirect to `/auth` as before

This uses the existing `user_roles` table (the same one `useUserRoles` queries) so no schema changes are needed.

## Files to Change

| File | Change |
|------|--------|
| `src/components/portal/ProtectedPortalRoute.tsx` | Add staff role check; bypass member redirect for staff |
