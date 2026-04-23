
Fix the admin lockout as a client-side auth handoff failure, not a credential or role-assignment problem.

Root cause
- The admin role still exists in the database (`super_admin` is present in `user_roles`).
- Recent auth logs show both:
  - successful authenticated `/user` responses (`200`)
  - transient `bad_jwt` / `missing sub claim` failures (`403`)
- The code currently treats those transient startup failures as corrupted auth and clears storage/signs the user out from multiple places during the same login handoff.
- The fresh session is being wiped or stranded before staff routing can complete.

What is actually breaking
- `src/contexts/AuthContext.tsx`
  - startup does `getSession()` and then immediately `getUser()`
  - on transient `bad_jwt` it calls `handleJwtError()` and clears auth
- `src/pages/Auth.tsx`
  - mount-time `checkAndCleanSession()` does its own `getSession()` / `getUser()` / `forceAuthReset()`
  - this duplicates auth cleanup on the login page itself
- `src/components/SessionMonitor.tsx`
  - runs another background `getSession()` / `getUser()` validation path and can clear auth
- `src/components/member/ProtectedMemberRoute.tsx`
  - does yet another aggressive `getUser()` / `refreshSession()` cycle
- `src/hooks/useUserRoles.ts`
  - role lookup retries are too short and still depend on a session that may be mid-restore

Implementation plan

1. Make `AuthContext` the only source of truth for auth startup
- Refactor `src/contexts/AuthContext.tsx` so initialization does:
  - subscribe to `onAuthStateChange`
  - restore with `getSession()`
  - set `user`, `session`, and `authReady` from that restore
- Remove aggressive startup `getUser()` validation from the critical login path.
- Do not clear storage during initial session restore unless there is a confirmed persistent failure outside the handoff window.
- Keep auth event callbacks synchronous only.

2. Remove duplicate session-cleanup logic from the auth page
- Delete the mount-time `checkAndCleanSession()` flow from `src/pages/Auth.tsx`.
- Stop using `hasAuthData()`, `supabase.auth.getSession()`, `supabase.auth.getUser()`, and `forceAuthReset()` automatically on page load.
- Keep only an explicit manual “Reset session” action for users to trigger themselves.
- The auth page should submit credentials and then wait for shared auth state + roles to resolve.

3. Make staff routing wait for confirmed auth readiness only
- Update `src/hooks/useUserRoles.ts` so it runs only after:
  - `authReady === true`
  - a real restored session/user exists
- Increase retry tolerance for post-login role fetches and treat early auth failures as retryable, not fatal.
- Keep explicit states:
  - loading
  - resolved
  - failed
- Never clear auth because role loading failed.

4. Keep signed-in staff on the handoff path instead of dropping them back onto the form
- Update `src/pages/Auth.tsx` so once `user` exists, the screen becomes a post-login handoff state:
  - “Finishing sign-in…”
  - or a staff access retry state if roles fail
- Do not fall back to the normal sign-in form while a valid signed-in user is waiting on role resolution.
- Preserve the rule that staff should never wait on `useUserProfile()` to reach admin.

5. Stop background validators from killing a fresh login
- Tighten `src/components/SessionMonitor.tsx`:
  - skip checks on `/auth`
  - extend the auth-transition grace window
  - do not clear storage on the first transient `/user` JWT failure after sign-in
- Tighten `src/components/member/ProtectedMemberRoute.tsx`:
  - stop doing its own aggressive session validation on mount
  - trust `AuthContext` for whether the user is authenticated
  - keep repair UI only for true downstream member-data problems, not auth bootstrap

6. Keep admin protection strict, but non-destructive
- Leave `src/components/admin/ProtectedAdminRoute.tsx` as the gate for staff access.
- Ensure it only decides among:
  - loading
  - retry access check
  - access denied
  - redirect to allowed admin page
- It should not indirectly trigger session cleanup through upstream auth regressions.

7. Add focused auth-sequence instrumentation while fixing
- Add temporary console breadcrumbs in:
  - `src/contexts/AuthContext.tsx`
  - `src/pages/Auth.tsx`
  - `src/hooks/useUserRoles.ts`
  - `src/components/SessionMonitor.tsx`
- Log:
  - auth event names
  - when `authReady` flips
  - when a session is restored
  - when cleanup/sign-out paths run
  - when role fetch starts/succeeds/fails
- This will confirm the exact point the session is being cleared if anything still survives after the refactor.

Files to update
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth.tsx`
- `src/hooks/useUserRoles.ts`
- `src/components/SessionMonitor.tsx`
- `src/components/member/ProtectedMemberRoute.tsx`
- `src/components/admin/ProtectedAdminRoute.tsx` if minor routing-state cleanup is needed

No backend/database change required
- No schema or policy change is needed for this fix.
- The role row exists already; the blocker is client auth lifecycle, not missing permissions data.

Expected result
- Admin credentials sign in successfully.
- The app stops clearing the fresh session during the post-login handoff.
- Staff accounts route into admin reliably.
- Admin access no longer depends on member-profile loading.
- The admin side becomes reachable again from the laptop instead of bouncing or stalling during sign-in.
