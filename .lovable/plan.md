

## Fix: Password Reset Link "Expired" for Reactivated Members

### Root Cause

When Alyssa clicked her recovery link, she was already logged in from a prior session. The UpdatePassword page waits for a `PASSWORD_RECOVERY` auth event or a brand-new session to appear. But when the user is already authenticated, the Supabase client may not fire that event reliably -- so the page falls through to "Invalid or Expired Link" even though the user has a perfectly valid session.

She then re-requests the link, clicks the old (consumed) email link again, and gets "One-time token not found" -- a dead end.

### The Fix

Simplify the UpdatePassword session check: **if the user is on `/update-password` and has any valid session, show the password form.** There's no security risk -- `supabase.auth.updateUser({ password })` requires an authenticated session regardless.

This change removes the fragile dependency on catching a specific auth event within a narrow time window.

### Changes

| File | Change |
|------|--------|
| `src/pages/UpdatePassword.tsx` | Simplify the session validation: if `getSession()` returns a session on any retry, show the form immediately. Keep the `PASSWORD_RECOVERY` event listener as a fast-path but don't require it. Remove the strict "only PASSWORD_RECOVERY or fresh SIGNED_IN" gate. |

### What stays the same

- If no session exists after all retries (4 seconds), the "Invalid or Expired Link" screen still shows with a "Request New Reset Link" button
- AuthContext still skips aggressive validation on `/update-password`
- SessionMonitor still skips health checks on `/update-password`
- The password update flow (call `updateUser`, sign out, redirect to `/auth`) is unchanged

### Technical Detail

Before (fragile):
```text
Only show form if:
  - PASSWORD_RECOVERY event fires, OR
  - SIGNED_IN event fires with a new session
```

After (robust):
```text
Show form if:
  - Any auth event with a session fires, OR
  - getSession() returns a session on any retry attempt
```

No database changes needed.

