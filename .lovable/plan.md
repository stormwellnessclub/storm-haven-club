
Fix the admin login failure by treating role-loading failures as errors to recover from, not as “this user is not staff,” and by removing the duplicate post-login role check that can strand admins on the auth screen.

1. Confirm the real source of failure in the login flow
- Keep the current backend/auth setup intact because the admin account and staff role already exist.
- Treat this as a frontend session/role-resolution problem:
  - login succeeds
  - staff role exists
  - frontend sometimes fails to route or denies access anyway

2. Make role loading authoritative and error-safe
- Update `src/hooks/useUserRoles.ts` so it has three distinct states:
  - loading
  - loaded with roles
  - failed to load roles
- Do not convert a failed `user_roles` query into `roles: []`.
- Preserve loading or expose an explicit `error`/`resolved` state so admin guards never confuse “query failed” with “user has no staff roles.”

3. Stop the admin route from locking staff out on transient role errors
- Update `src/components/admin/ProtectedAdminRoute.tsx` to handle:
  - auth still restoring
  - roles still loading
  - role query failed
  - confirmed non-staff user
- Only show “Access Denied” after roles have successfully loaded and are truly empty.
- If role loading fails, show a recoverable error state with retry instead of denying admin access.

4. Replace the duplicate ad hoc role query on the auth page
- Refactor `src/pages/Auth.tsx` so the post-login redirect does not perform its own direct `user_roles` lookup with silent early return behavior.
- Reuse the shared role-loading logic instead of duplicating it.
- If staff roles are still resolving after sign-in, show a short “Signing you in…” state.
- If role resolution fails, surface a clear error/retry path instead of leaving the user stuck on `/auth`.

5. Tighten session-repair behavior so it does not erase a fresh login too aggressively
- Review the JWT/session recovery paths in:
  - `src/contexts/AuthContext.tsx`
  - `src/components/SessionMonitor.tsx`
  - `src/components/member/ProtectedMemberRoute.tsx`
- Prevent transient post-login validation issues from immediately collapsing into sign-out or bad local state.
- Keep corrupted-token cleanup, but avoid clearing a freshly established session during normal login routing.

6. Make admin routing deterministic after successful sign-in
- Ensure staff users are redirected from `/auth` to the correct admin landing page once:
  - auth is ready
  - session is valid
  - staff roles are confirmed
- Ensure non-staff users continue through the existing waiver/member flow without affecting staff login.

7. Validate the full admin login path
- Verify the admin account can:
  - submit email/password successfully
  - leave `/auth`
  - reach `/admin` (or its role-based default page)
  - stay signed in without bouncing back or showing access denied
- Verify failed role fetches now show a retry/error state rather than a false non-staff result.
- Recheck the admin dashboard/check-in pages after login so the check-in count is evaluated only from a valid authenticated admin session.

Technical details
- Backend data already confirms the admin user and `super_admin` role exist, so this should not require database changes.
- Most likely frontend failure points:
  - `src/hooks/useUserRoles.ts`
  - `src/components/admin/ProtectedAdminRoute.tsx`
  - `src/pages/Auth.tsx`
- Secondary session-hardening review:
  - `src/contexts/AuthContext.tsx`
  - `src/components/SessionMonitor.tsx`
  - `src/components/member/ProtectedMemberRoute.tsx`

Expected result
- Admin login works again.
- Staff are no longer treated as non-staff when role lookup briefly fails.
- The auth page no longer gets stuck after a successful login.
- Admin check-in/dashboard data can load from a real authenticated session instead of failing behind broken access flow.
