# Run Admin and Front Desk side by side on one computer

## Why it happens today

Both Admin and Front Desk are the same web app and both use a real signed-in staff session. That session is saved in the browser's shared storage for the whole site, so every window and tab of that browser shares one login. Signing into Front Desk in a second window replaces the Admin session in the first (and vice versa) — which matches what the sign-in history shows: a Front Desk sign-out immediately followed by an Admin sign-in from the same machine.

## Works right now, no code change

Open Front Desk in a **separate browser profile or a private/incognito window** (or a different browser). Storage is isolated there, so Admin stays signed in in the normal window.

## The fix to build: per-window sessions for Front Desk

Make Front Desk and Kiosk windows keep their login in **tab-scoped storage** instead of the shared site storage, so each window holds its own identity.

1. Add a small tab-scope module loaded before the app starts (in `src/main.tsx`).
   - A tab is marked "front desk scope" when it first opens any `/frontdesk/*` or `/kiosk/*` URL, or `/auth?scope=frontdesk`. The mark is stored per tab and survives navigation inside that window.
2. In a marked tab, route only the auth-session keys (the `sb-*` keys the backend client writes) to per-tab storage, leaving every other stored preference untouched. Unmarked tabs (Admin, member portal, public site) keep today's shared behavior exactly.
   - Implemented as a narrow storage shim installed before the backend client is created, since the generated client file itself must not be edited.
3. Front Desk sign-out clears only that window's session; the Admin window is unaffected.
4. Add a "Front Desk sign-in" link that opens `/auth?scope=frontdesk` in a new window so staff land in a correctly scoped window without knowing the rule.

## Trade-offs to be aware of

- A front-desk window that is closed loses its login and must sign in again — intended, and better for a shared front-desk machine.
- Duplicating a front-desk tab copies that window's session into the copy; both are still front-desk scoped, so nothing leaks into Admin.

## Verification

- Sign into Admin in window A, then open `/frontdesk` in window B and sign in as the front desk account. Reload window A and confirm it is still the Admin user, and window B is still the front desk user.
- Sign out of Front Desk in window B and confirm window A stays signed in.
- Confirm normal member and public sign-in behavior is unchanged in an ordinary window.
