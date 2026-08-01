# Fix: front desk staff can't get in

## What's actually happening

Sign-in itself works — the `frontdesk@stormwellnessclub.com` account authenticates successfully and does have the `front_desk` role. The block comes after login:

1. Login sends front desk staff to `/frontdesk`.
2. `/frontdesk` renders the authenticated front desk shell, which then renders the older kiosk page.
3. That older page still contains a leftover **PIN gate** from the removed shared-kiosk system. Since the tab has no `kioskUnlocked` flag, staff land on a "Enter PIN" screen instead of Reception — with no working PIN to enter.

There is also an orphaned `/front-desk-login` PIN screen file still in the codebase that actively signs the user out; it isn't routed anymore but it's dead code that will cause confusion.

## The fix

1. Remove the PIN gate from the Reception page so an authenticated `front_desk` / manager / admin user lands directly on the check-in screen. Access stays enforced by the existing route guard (login + role), not by a PIN.
2. Delete the orphaned front desk PIN login page.
3. Leave the separate `/kiosk/*` unattended-tablet screens untouched — those still legitimately use the PIN gate.

## Verification

After the change: sign in as the front desk account and confirm it lands on `/frontdesk` Reception with search, attendance, cafe banner and tabs working — no PIN prompt. Also confirm a plain member account signing in is still redirected away from `/frontdesk`.

## Technical notes

- `src/pages/FrontDesk.tsx`: drop the `isUnlocked` / `KioskPinGate` wrapper in the default export; render the kiosk content directly.
- Delete `src/pages/FrontDeskLogin.tsx` (unrouted; calls `signOut` on mount).
- No database or edge function changes; `verify_kiosk_pin` and `kiosk-session` stay for the `/kiosk/*` routes.
