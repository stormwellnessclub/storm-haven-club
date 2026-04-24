
## Goal
Restore reliable admin sign-in so your admin account can always reach the admin area after a successful login.

## Confirmed facts
- Your admin account `storm@stormwellnessclub.com` still exists in the backend.
- That account still has the `super_admin` role in `user_roles`.
- The backend role helpers also return `true` for that account.
- Recent auth logs show the login itself succeeds (`/token` 200, `/user` 200).

This means the damage is not “you lost admin rights.” The break is in the frontend handoff after login.

## What is actually broken
There is a real logic flaw in the current auth flow:

### 1. The auth page can trap a signed-in admin in an infinite “Finishing sign-in…” state
File: `src/pages/Auth.tsx`

Right now:
- `waitingForStaffRoles` is `true` whenever `!rolesResolved`
- that loading screen renders before the `rolesError` recovery UI
- so if role loading fails even once, the retry/error state becomes unreachable

That means a successful admin login can get stranded on `/auth` forever.

### 2. Role loading is still too fragile during the post-login handoff
File: `src/hooks/useUserRoles.ts`

The hook:
- depends on a short retry window
- uses `getSession()` inside the retry loop
- marks the role load as failed after a few transient misses

Because your backend role is valid, any failure here should be treated as a temporary loading problem, not as a final access decision.

### 3. Admin route protection is safe-er than before, but still depends on the fragile role hook
File: `src/components/admin/ProtectedAdminRoute.tsx`

The guard correctly avoids false “Access Denied” once roles resolve, but it can only work if the role hook eventually resolves. If the hook fails during login and the auth page never exits, the route guard never gets a chance to recover.

## Plan

### 1. Fix the auth page state order so signed-in staff can recover
Update `src/pages/Auth.tsx` to separate these states explicitly:
- auth not ready
- signed in + roles still loading
- signed in + roles failed to load
- signed in + staff confirmed
- signed in + non-staff confirmed

Implementation changes:
- change `waitingForStaffRoles` so it does not swallow `rolesError`
- render the retry/reset-session UI before the generic loading branch when `user && rolesError && !rolesResolved`
- keep the loading screen only for true in-progress states

Expected result:
- a signed-in admin will no longer get stuck forever on “Finishing sign-in…”
- if role lookup hiccups, the page will show a recoverable retry state instead of hanging

### 2. Make role resolution more deterministic
Update `src/hooks/useUserRoles.ts`.

Implementation changes:
- keep `authReady && !!user && !!session` as the gate
- stop treating a transient session miss inside the retry loop as a terminal failure
- prefer one authoritative role fetch path first, then one fallback path:
  - primary: `has_any_staff_role` / `has_role` RPC path
  - fallback: direct `user_roles` table query for the specific user
- only set `error` after both paths fail consistently
- preserve the last successful roles if a later refresh fails

Why this helps:
- your backend role helpers are already correct
- relying more on security-definer RPCs reduces sensitivity to RLS/session timing edge cases during startup

### 3. Simplify the post-login redirect on the auth page
Still in `src/pages/Auth.tsx`:
- once staff roles are confirmed, navigate immediately to `getDefaultAdminPage(roles)`
- do not leave the page in a mixed “signed in but still rendering login shell” state
- keep member/non-member routing separate from staff routing

Expected result:
- staff accounts go straight to admin once roles resolve
- non-staff accounts continue to member/portal logic without interfering with staff login

### 4. Harden the admin guard for one more failure mode
Update `src/components/admin/ProtectedAdminRoute.tsx`.

Implementation changes:
- keep the current loading and retry UI
- if `user` exists and a role refresh is already underway after an earlier failure, continue showing “Verifying access…” rather than flipping states
- make retry call the shared role hook only, not any ad hoc auth reset logic

Expected result:
- once the user reaches `/admin`, the guard remains stable instead of bouncing between states

### 5. Review auth initialization for the remaining race edge
Update `src/contexts/AuthContext.tsx`.

Implementation changes:
- keep `onAuthStateChange` synchronous
- make `authReady` reflect completion of the initial restore path, not just the first event that arrives
- avoid any ambiguity between “auth event fired” and “safe to evaluate protected routes”

This is a smaller cleanup than the auth-page fix, but it removes one remaining source of timing inconsistency.

### 6. Validate against the real admin account
After implementation:
- sign in with `storm@stormwellnessclub.com`
- confirm `/auth` is left after successful login
- confirm `/admin` loads without spinner lock or false denial
- confirm refresh/reopen still preserves admin access
- confirm the retry UI appears only on genuine temporary failures

## Files to update
- `src/pages/Auth.tsx`
- `src/hooks/useUserRoles.ts`
- `src/components/admin/ProtectedAdminRoute.tsx`
- `src/contexts/AuthContext.tsx`

## Technical details
- Backend state is healthy for the admin account:
  - member record exists
  - profile exists
  - `user_roles` contains `super_admin`
  - `has_role(user_id, 'super_admin') = true`
- The current failure is frontend-only.
- Most likely direct cause: unreachable error recovery in `Auth.tsx` due to state-ordering logic.
- Secondary cause: role resolution remains too brittle during session restoration.

## Expected result
- Your admin login works again without getting stranded on the auth screen.
- A temporary role lookup hiccup no longer acts like a lockout.
- Your account retains full admin access exactly as the backend already says it should.
