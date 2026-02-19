

## Fix Non-Member Portal Routing and Bugs

### Problem Summary

The portal is built but has routing gaps that prevent non-members from reaching it, and a data query bug on the dashboard.

### Changes

#### 1. Fix ProtectedMemberRoute: Redirect non-members to /portal

**File: `src/components/member/ProtectedMemberRoute.tsx`**

At the bottom of the component (line ~189), before `return <>{children}</>`, add a check: if `applicationStatus?.status === "no_application"`, redirect the user to `/portal` instead of rendering the member portal.

```text
// Before the final return:
if (applicationStatus?.status === "no_application") {
  return <Navigate to="/portal" replace />;
}
```

This ensures that any authenticated user without a membership or pending application is routed to the class portal automatically. The existing `/member` default redirect in `Auth.tsx` becomes the single entry point -- users land on `/member`, which then sorts them into the correct portal.

#### 2. Fix Dashboard upcoming bookings query

**File: `src/pages/portal/Dashboard.tsx`**

The current query filters `gte("booked_at", new Date().toISOString())` which checks when the booking was created, not the actual class date. Fix to join through `class_sessions` and filter by `session_date`:

Replace the upcoming count query (lines 17-30) with:

```typescript
const { data: upcomingCount = 0 } = useQuery({
  queryKey: ["portal-upcoming-count", user?.id],
  queryFn: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from("class_bookings")
      .select("*, class_sessions!inner(session_date)", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "confirmed")
      .gte("class_sessions.session_date", today);
    if (error) throw error;
    return count || 0;
  },
  enabled: !!user,
});
```

#### 3. No changes needed for member upgrade scenario

When a non-member becomes a gym member (admin creates their member record with matching email), the next time they visit `/portal`, `ProtectedPortalRoute` queries the `members` table, finds the active record, and redirects to `/member`. This already works correctly -- the check runs on every route render.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/member/ProtectedMemberRoute.tsx` | Add `no_application` redirect to `/portal` |
| `src/pages/portal/Dashboard.tsx` | Fix upcoming bookings query to use `session_date` |

### What This Achieves

After login, the flow becomes:
- User signs in and lands on `/member` (default)
- `ProtectedMemberRoute` checks their status:
  - Active/pending member: renders member portal (existing behavior)
  - Pending application: shows "Under Review" (existing behavior)
  - No application (non-member): redirects to `/portal` (new)
- If user later becomes a member, `/portal` routes auto-redirect to `/member`

No new files or database changes required.
