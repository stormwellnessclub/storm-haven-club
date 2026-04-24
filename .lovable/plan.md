
## Goal
Give you a complete map of the admin login logic and a concrete fix plan for why your admin login is failing.

## What the admin login logic currently consists of
Your admin access is not controlled by one file. It is split across these files:

1. `src/contexts/AuthContext.tsx`
- Restores session with `supabase.auth.getSession()`
- Subscribes to `supabase.auth.onAuthStateChange(...)`
- Exposes `user`, `session`, `loading`, `authReady`
- `signIn()` calls `supabase.auth.signInWithPassword({ email, password })`

2. `src/pages/Auth.tsx`
- Calls `signIn(email, password)`
- After sign-in, waits for:
  - auth to become ready
  - roles to load from `useUserRoles()`
  - profile to load for non-staff users
- If staff roles resolve, it redirects to `getDefaultAdminPage(roles)`

3. `src/hooks/useUserRoles.ts`
- Reads `user`, `session`, `authReady` from `useAuth()`
- Tries RPCs first:
  - `has_any_staff_role`
  - `has_role`
- Falls back to reading `user_roles`
- Decides whether the signed-in user is staff/admin

4. `src/components/admin/ProtectedAdminRoute.tsx`
- Protects all `/admin...` routes
- If not logged in: redirects to `/auth`
- If roles fail to resolve: shows retry UI
- If no staff roles: shows “Access Denied”
- If roles exist: allows route or redirects to allowed admin page

5. `src/lib/permissions.ts`
- Defines which roles can access which admin pages
- `super_admin` can access everything
- `getDefaultAdminPage(['super_admin'])` returns `/admin`

6. `src/App.tsx`
- Every `/admin...` route is wrapped in `ProtectedAdminRoute`

7. Session cleanup / token handling files
- `src/components/SessionMonitor.tsx`
- `src/lib/jwtErrorHandler.ts`
- `src/lib/authStorage.ts`
These handle stale or corrupted auth tokens and can sign the user out / clear storage.

## Confirmed facts
- Your account `storm@stormwellnessclub.com` still exists.
- It still has `super_admin`.
- The backend role record is correct for user `6d30811c-7e66-4ea9-b135-f5c340bf78fc`.
- Recent backend auth logs show:
  - successful login on `/token` with status `200`
  - successful `/user` checks on the live domain
  - but also a `/user` failure with `403: invalid claim: missing sub claim` from preview

## Most likely actual failure
This does not look like “you lost admin.” It looks like a client-side bad session/token state.

The strongest evidence is:
- login succeeds
- your admin role is intact
- preview later sends `/user` with `bad_jwt / missing sub claim`

That usually means the browser is holding a corrupted or mismatched stored session token, so the frontend believes it is authenticated at one step and then fails when protected queries run.

## Why the current code is fragile
1. `AuthContext.tsx` marks auth state from `onAuthStateChange` plus `getSession()`, but the app still has multiple places that independently probe auth/session.
2. `useUserRoles.ts` re-calls `supabase.auth.getSession()` inside the retry loop, which can amplify a bad-token state instead of isolating it.
3. `SessionMonitor.tsx` and manual reset paths clear auth storage, but the app does not have one single authoritative “session invalid => hard reset once” flow.
4. Admin routing depends on both auth restoration and role resolution completing cleanly; when token state is corrupted, the handoff becomes inconsistent.
5. The preview and live domain can hold different storage/session states, so preview can fail while live still authenticates correctly.

## Implementation plan

### 1. Make auth restoration the single source of truth
Update `src/contexts/AuthContext.tsx` so:
- `getSession()` is the only restore gate
- `authReady` means restore is finished
- subsequent auth events only update user/session, not readiness semantics
- expose one derived state for “authenticated and usable”

### 2. Simplify role loading so it depends only on restored auth
Update `src/hooks/useUserRoles.ts` so:
- it only runs when `authReady && user`
- it stops re-checking `supabase.auth.getSession()` inside the retry loop
- it treats JWT/session failures differently from “no roles”
- it surfaces a specific auth/session error vs a role lookup error

### 3. Add explicit bad-token recovery
Update:
- `src/lib/jwtErrorHandler.ts`
- `src/components/SessionMonitor.tsx`
- possibly `src/pages/Auth.tsx`

So that:
- if `/user` or role fetch hits `bad_jwt` / `missing sub claim`
- the app performs one controlled local sign-out + auth storage purge
- then returns the user to `/auth` with a clear message instead of spinning or half-routing

### 4. Separate “cannot authenticate” from “not authorized”
Update:
- `src/pages/Auth.tsx`
- `src/components/admin/ProtectedAdminRoute.tsx`

So the UI distinguishes:
- auth/session invalid
- signed in but roles still loading
- signed in but role lookup failed
- signed in with no staff role
- signed in with staff role

Right now those states are too tightly coupled.

### 5. Add temporary diagnostics around the admin handoff
Add focused console logging in:
- `AuthContext.tsx`
- `useUserRoles.ts`
- `ProtectedAdminRoute.tsx`
- `SessionMonitor.tsx`

Log:
- auth event
- whether session exists
- whether JWT error occurred
- whether roles RPC/table lookup was attempted
- final redirect decision

This will make the next failure attributable instead of guesswork.

### 6. Validate in both environments
After changes:
- test sign-in on preview
- test sign-in on `stormwellnessclub.com`
- hard refresh
- close/reopen browser
- confirm `/admin` loads directly for `super_admin`
- confirm corrupted token path forces a clean reset instead of trapping the session

## Files to review first
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth.tsx`
- `src/hooks/useUserRoles.ts`
- `src/components/admin/ProtectedAdminRoute.tsx`
- `src/components/SessionMonitor.tsx`
- `src/lib/jwtErrorHandler.ts`
- `src/lib/authStorage.ts`
- `src/lib/permissions.ts`
- `src/App.tsx`

## Technical takeaway
Your admin login path is:

```text
submit email/password
-> AuthContext.signIn()
-> Supabase password login
-> AuthContext restores session
-> Auth page waits for roles
-> useUserRoles resolves super_admin
-> Auth page redirects to /admin
-> ProtectedAdminRoute verifies role access
-> admin page renders
```

The backend portion is currently healthy.
The failure point is most likely the client session becoming invalid after login in preview (`bad_jwt: missing sub claim`), which then breaks the role/admin handoff.

## Expected result after implementation
- you can log in as `storm@stormwellnessclub.com`
- you are routed directly into `/admin`
- a corrupted token no longer leaves you in a broken half-signed-in state
- auth failures and role failures become visibly different and debuggable
