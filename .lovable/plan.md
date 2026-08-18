# Keep Admin and Front Desk Signed In Separately

## Goal

Allow Admin and Front Desk to remain signed into different staff accounts in separate browser windows on the same computer, without either login, token refresh, or sign-out replacing the other.

## Confirmed cause

- The current Front Desk shim redirects saved auth values from shared browser storage into per-window storage (`src/lib/tabAuthScope.ts`).
- The auth client still uses the same default auth storage key in both windows (`src/integrations/supabase/client.ts`). The installed auth library creates a `BroadcastChannel` from that key, so sign-in/sign-out events can still cross between Admin and Front Desk even though the stored values were redirected.
- The scoped login URL is preserved long enough to isolate storage, but the staff routing logic in `src/pages/Auth.tsx` always sends staff to their normal Admin start page rather than honoring `scope=frontdesk` and returning that window to `/frontdesk`.
- The latest asynchronous compile failed, but its supplied output omits the actual source diagnostic. The current working tree passes `git diff --check`; the exact compile error must be captured and cleared as part of verification.

## Implementation

1. Replace the global `window.localStorage` monkey-patch with an explicit auth-storage configuration chosen before the shared client is created:
   - Admin uses the existing shared/persistent auth storage and default auth key.
   - Front Desk/Kiosk uses `sessionStorage` and a distinct Front Desk auth storage key.
   - The different key separates both persisted sessions and the auth library’s cross-window broadcast channel.

2. Keep Front Desk scope stable through the complete flow:
   - Detect `/frontdesk`, `/kiosk`, and `/auth?scope=frontdesk` at startup.
   - When a scoped staff login succeeds, route to the original Front Desk path (or `/frontdesk`) instead of the Admin landing page.
   - Keep Front Desk sign-out scoped to that window and return to `/auth?scope=frontdesk`, so it cannot disturb Admin.

3. Preserve existing Admin, member, password-reset, and ordinary `/auth` behavior. Do not change permissions, roles, or backend authorization.

4. Clear the compile gate, using the full source diagnostic if it remains after the auth changes.

## Verification

- Run the project compile/build checks successfully.
- In two independent browser windows on the same browser profile:
  1. Sign into Admin account A and leave an Admin page open.
  2. Open Front Desk Mode in a new window and sign into Front Desk account B.
  3. Confirm Admin remains account A and Front Desk remains account B after navigation and reloads.
  4. Sign out of Front Desk and confirm Admin remains signed in.
  5. Sign back into Front Desk, sign out of Admin, and confirm Front Desk remains signed in.
- Confirm direct `/frontdesk` access redirects to the scoped login and returns to Front Desk after authentication.