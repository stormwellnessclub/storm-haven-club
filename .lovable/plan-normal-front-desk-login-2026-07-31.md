# Normal Front Desk Login

## Goal
Front-desk employees will sign in through the same email-and-password form as every other staff member. Accounts assigned the `front_desk` role will automatically land in the dedicated Front Desk workspace.

## Changes
1. Remove the special-case redirect that sends `frontdesk@stormwellnessclub.com` from the normal sign-in form to the PIN page.
2. Protect every `/frontdesk` route with authenticated role checks:
   - signed out → normal `/auth` login
   - `front_desk`, admin, or manager role → Front Desk workspace
   - unauthorized account → its permitted destination
3. Replace the shared kiosk-PIN gate inside the Front Desk shell with the authenticated staff session. The separate kiosk routes can keep their PIN behavior.
4. Change the Front Desk lock/logout action to sign out the authenticated user and return to the normal login page; remove the misleading device-unlock and tracking-bypass state from this workspace.
5. Keep existing Front Desk permissions and its separation from sensitive admin/financial pages unchanged.

## Verification
- Sign in through `/auth` with a `front_desk` account and confirm automatic routing to `/frontdesk` without any PIN prompt.
- Confirm a signed-out visitor opening `/frontdesk` is redirected to `/auth`.
- Confirm a member account cannot open Front Desk pages.
- Confirm logout ends the session and returns to normal sign-in.
- Confirm `/kiosk/*` remains PIN-gated and unaffected.

## Technical Notes
The current role resolver already maps `front_desk` to `/frontdesk`; the conflicting email exception in `Auth.tsx` and kiosk gate in `FrontDeskShell.tsx` will be removed from the Front Desk path. A dedicated route guard will enforce authentication consistently across all Front Desk routes.