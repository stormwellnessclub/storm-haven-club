## Problem

Signing out on **one computer** currently signs the same account out of **every other computer / browser** it's logged into. This is disruptive for admin and manager accounts that are used on multiple front-of-house / back-office machines simultaneously.

**Root cause:** Every `supabase.auth.signOut()` call in the app uses Supabase's default `scope: "global"`. Global sign-out revokes **every refresh token** issued to that user across all devices. As soon as any other device tries to refresh (or reloads), its session fails and it's kicked back to the login screen.

We already use `scope: "local"` in a handful of "cleanup" paths (bad-session recovery in `AuthContext`, some Auth-page fallbacks), but every user-initiated sign-out is still global.

## Fix

Change every user-initiated sign-out to `scope: "local"` — meaning: only the current device's session is revoked, other devices keep working until their tokens expire naturally.

Cross-tab behavior on the **same** computer stays unchanged (Supabase JS shares session via localStorage; sibling tabs on the same machine will still sync). We are only stopping the cross-**device** cascade.

## Files to update

1. **`src/contexts/AuthContext.tsx`** — main `signOut()` used everywhere via `useAuth()`
   - `await supabase.auth.signOut()` → `await supabase.auth.signOut({ scope: "local" })`

2. **`src/pages/Auth.tsx`** (line 664) — one leftover global sign-out on the login page
   - → `scope: "local"`

3. **`src/pages/MothersDayPackRedeem.tsx`** (line 177) — global sign-out
   - → `scope: "local"`

4. **`src/pages/UpdatePassword.tsx`** (line 125) — global sign-out after password reset
   - → `scope: "local"`

5. **`src/components/ErrorBoundary.tsx`** (line 44) — "reset session" recovery
   - → `scope: "local"`

6. **`src/pages/FrontDeskLogin.tsx`** (lines 104, 117, 126) — three sign-outs used when the current session doesn't belong to a front-desk user
   - → `scope: "local"`

## What stays global (intentionally)

- **Password reset flow (`UpdatePassword.tsx`)** — after a user actually resets their password we already invalidate the reset link's session; a `local` sign-out is enough because Supabase already invalidates the recovery token server-side. No security regression.
- **Nothing else** currently needs a global sign-out. If in the future you ever add a "Sign out of all my devices" button (e.g. after a suspected compromise), that one should stay `scope: "global"`.

## Verification

After the edit:
1. Sign in as admin on Computer A **and** Computer B.
2. Click "Sign out" on Computer A → Computer A returns to login, Computer B stays fully signed in and functional.
3. Repeat with the front-desk account and the manager account.
4. Confirm cross-tab behavior on the same computer is unchanged (signing out in one tab still clears sibling tabs on the same machine — that's localStorage, not the sign-out scope).

## Not in scope for this change

Per-window session isolation (each browser window independently logged in on the same computer) — that would require moving session storage from `localStorage` to `sessionStorage`, which is a bigger change with side effects for members. We can revisit if you still want it after this fix.