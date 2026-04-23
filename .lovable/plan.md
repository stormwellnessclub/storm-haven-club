
Fix the admin sign-in regression and the false “0 checked in today” state by making authenticated queries wait until the session is truly ready, instead of running on the first auth event.

1. Stabilize auth initialization in the app context
- Update `src/contexts/AuthContext.tsx` so auth is considered ready only after the initialization pass completes, not immediately on the first `onAuthStateChange` event.
- Keep the auth listener synchronous, but separate:
  - live session/user updates
  - “auth is fully initialized and safe for RLS queries”
- Add an explicit readiness signal to the context, such as `authReady` or `initialized`.

2. Prevent early role checks from locking staff out
- Update `src/hooks/useUserRoles.ts` to wait for the new auth-ready flag before querying `user_roles`.
- While auth is not ready, keep the hook in a loading state instead of returning an empty role list.
- Treat “not ready yet” differently from “user has no staff roles,” so staff are not mistakenly denied admin access.
- Update `src/components/admin/ProtectedAdminRoute.tsx` to use the readiness flag and only evaluate role access after auth and roles are both truly ready.

3. Fix post-login staff routing on the auth page
- Update `src/pages/Auth.tsx` so the staff-role lookup and redirect logic runs only after auth readiness is confirmed.
- Avoid interpreting a temporary empty `user_roles` response during session restoration as a real non-staff result.
- Keep staff on a short “preparing/verifying” state until roles are confirmed, then route to their admin landing page.

4. Gate admin attendance queries behind auth readiness
- Update `src/hooks/useUnifiedAttendance.ts` so it does not fetch until auth is ready and a signed-in user exists.
- Preserve the resilient partial-failure handling already added, but stop the initial unauthenticated fetch that can seed the UI with zero counts.
- Trigger a clean refetch once auth becomes ready.

5. Gate dashboard counts behind auth readiness
- Update `src/pages/admin/Dashboard.tsx` so the “Today’s Check-Ins” and related admin stats queries use the auth-ready signal before executing.
- Keep the partial-failure behavior, but ensure zero is only shown after an authenticated query actually completes.

6. Review related session-check logic for the same race
- Check `src/components/SessionMonitor.tsx` and `src/components/member/ProtectedMemberRoute.tsx` for any logic that validates or refreshes too aggressively during startup.
- Keep the JWT-repair safeguards, but avoid a startup race where session validation runs before the restored token is available.

7. Validate the fixed behavior
- Confirm an admin can sign in and be routed back into the admin area without seeing a false access-denied state.
- Confirm `useUserRoles()` resolves the real staff roles after login.
- Confirm the dashboard and admin check-in page show the real non-zero today count instead of an initial zero caused by premature RLS queries.
- Confirm loading states show while auth is restoring, rather than flashing bad zero/empty states.

Technical details
- Likely root cause: authenticated queries are firing during the small window where the app has a user/session event but the token is not yet fully restored for backend policy evaluation. In that state, role and attendance queries can return empty/zero results without obvious frontend errors.
- Primary files to update:
  - `src/contexts/AuthContext.tsx`
  - `src/hooks/useUserRoles.ts`
  - `src/components/admin/ProtectedAdminRoute.tsx`
  - `src/pages/Auth.tsx`
  - `src/hooks/useUnifiedAttendance.ts`
  - `src/pages/admin/Dashboard.tsx`
  - possibly `src/components/SessionMonitor.tsx`
  - possibly `src/components/member/ProtectedMemberRoute.tsx`
- Expected result:
  - admin sign-in works again
  - staff roles are not lost during startup
  - today’s check-ins no longer show false zeroes caused by auth timing
