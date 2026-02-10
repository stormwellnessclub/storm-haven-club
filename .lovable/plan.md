

## Fix: Password Reset Link Not Working

### Root Cause

There is a race condition between `AuthContext` and `UpdatePassword` that destroys the recovery session.

When a user clicks the password reset link:

1. Supabase client processes the URL hash fragment and creates a valid recovery session
2. `AuthContext.initializeAuth()` finds the session via `getSession()`, then calls `getUser()` to validate it with the server
3. If `getUser()` returns any error (which can happen with fresh recovery tokens due to timing), the code tries `refreshSession()`. If that also fails, it calls `clearAuthStorage()` and `signOut()` -- destroying the recovery session
4. By the time `UpdatePassword` checks for a session, it has been wiped

Additionally, the `SessionMonitor` runs a health check after 1 second, which can also destroy the recovery session through the same aggressive validation logic.

### Solution

Make `UpdatePassword.tsx` self-contained and resilient by:

1. Processing the URL hash BEFORE `AuthContext` can interfere
2. Explicitly calling `supabase.auth.getUser()` itself to validate (instead of relying on session timing)
3. Using a longer, smarter retry mechanism with multiple attempts
4. Preventing `SessionMonitor` from interfering while on the `/update-password` route

### Changes

**1. `src/pages/UpdatePassword.tsx` -- Complete rewrite of session detection**

Replace the `useEffect` with a more robust approach:

- On mount, immediately check for hash fragments in the URL (indicating a recovery redirect)
- Register `onAuthStateChange` listener and wait up to 5 seconds for `PASSWORD_RECOVERY` or `SIGNED_IN` events
- Use multiple retries of `getSession()` at 1s, 2s, and 4s intervals instead of a single 2s timeout
- Add console logging so we can diagnose any future issues
- If a session is found at any point during this window, set `isValidSession = true` and stop retrying

**2. `src/components/SessionMonitor.tsx` -- Skip health check on /update-password**

Add a check at the top of `checkSessionHealth` to skip session validation when the current URL path is `/update-password`. This prevents the monitor from destroying a fresh recovery session before the user has a chance to set their new password.

**3. `src/contexts/AuthContext.tsx` -- Guard against destroying recovery sessions**

In the `initializeAuth` function, before calling `getUser()`, check if the current URL path is `/update-password`. If so, skip the aggressive server-side validation and trust the session from `getSession()`. This prevents the auth context from interfering with the password recovery flow.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/UpdatePassword.tsx` | Rewrite session detection with multi-retry, longer timeout, and console logging |
| `src/components/SessionMonitor.tsx` | Skip health check when on `/update-password` route |
| `src/contexts/AuthContext.tsx` | Skip aggressive validation when on `/update-password` route |

