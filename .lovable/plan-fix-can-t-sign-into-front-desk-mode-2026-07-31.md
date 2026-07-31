# Fix: can't sign into Front Desk mode

## What's happening

The screenshot shows a sign-in attempt on the regular member/admin sign-in page (`/auth`) using `frontdesk@stormwellnessclub.com` + a typed password, which returns "Invalid credentials". The backend auth log confirms two `invalid_credentials` failures from that page tonight.

Confirmed by checking the account and the front desk flow:

- The `frontdesk@stormwellnessclub.com` account exists, is confirmed, not banned, has only the `front_desk` role, and last signed in successfully on Jul 30 (05:52 UTC) — so the account is healthy.
- Its password is not a human-typed password. It is the stored `FRONTDESK_ACCOUNT_PASSWORD` secret, and the `kiosk-session` backend function is the only thing that signs in with it. The function also rewrites that account's password to the secret's value on every unlock, so any password typed by hand will not match.
- The intended front desk entry point is the PIN screen at `/front-desk-login` ("Front desk mode? Unlock here" at the bottom of the sign-in page). It verifies the front desk PIN, then silently gets the session behind the scenes.
- The kiosk PIN record exists in the database and the PIN check function is callable, so the PIN path itself is intact.

So this isn't a broken login — it's the wrong door. Email + password for the front desk account will never work by design.

## Plan

1. Make the front desk entry obvious on the sign-in page: turn the small "Front desk mode? Unlock here" text into a clear secondary button so staff stop trying email/password.
2. Add a guard on the sign-in page: if the email typed is `frontdesk@stormwellnessclub.com`, don't attempt a password sign-in — show a message ("Front desk uses a PIN") and send them straight to `/front-desk-login`.
3. On the PIN screen, surface real failure reasons instead of silently continuing: today, if the PIN is right but the background session exchange fails, it still navigates to `/frontdesk` and everything looks broken. Show an explicit error and stay on the screen when the session exchange fails.
4. Verify by unlocking with the PIN in a headless browser run and confirming a front desk session is established and the Reception screen loads data.

## Technical notes

- Files touched: `src/pages/Auth.tsx` (front desk CTA + email guard), `src/pages/FrontDeskLogin.tsx` (surface `startKioskSession` failures), no backend/schema changes.
- `supabase/functions/kiosk-session/index.ts` stays as-is; it's working (PIN → `front_desk` service session).
- If the current PIN is unknown, it can be reset from Admin → Staff PINs; that is a data action, not a code change.
