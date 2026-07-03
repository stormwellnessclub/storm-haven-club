# Front Desk-Only Login

Give the front desk its own sign-in page and its own account type. Those accounts can only see the kiosk. If they try to open any admin page, they're silently sent back to `/kiosk/reception`. Admins/managers continue to use the normal `/auth` in a separate window.

**Nothing existing changes until you explicitly create a front-desk-only account.** The current PIN-based `/kiosk/*` and `/front-desk` flows keep working exactly as they do today.

## How front-desk-only accounts are identified

An account is "front-desk-only" when its **only** staff role is `front_desk` (no `admin`, `manager`, `super_admin`, `spa_staff`, etc.). No schema change — just create a Supabase user account and assign it the `front_desk` role only.

## 1. New sign-in page: `/front-desk-login`

- Storm-branded, minimal (email + password, small link to `/reset-password`, no signup).
- On success:
  - Only `front_desk` role → set `sessionStorage.kioskUnlocked = "true"` (skips PIN) and redirect to `/kiosk/reception`.
  - Has any higher role → inline error: "This login is for front desk accounts only. Admins sign in at /auth." then sign back out.
  - No staff roles → "Not authorized."
- Public route.

## 2. Lock front-desk-only accounts out of `/admin/*`

Update `ProtectedAdminRoute`: if the signed-in user's roles are exactly `['front_desk']`, silently `<Navigate to="/kiosk/reception" replace />` — no error screen, no admin flash. All other staff behave exactly as today.

Also hide the "Admin" button in the `KioskShell` header for these accounts.

## 3. Kiosk PIN gate stays for walk-up devices

The shared PIN (`0201`) on `/kiosk/*` and `/front-desk` continues to work for tablets not signed into a user account. Signed-in front-desk accounts just bypass it because the new login sets `kioskUnlocked`.

## 4. Small entry-point tweaks

- Tiny "Front desk sign in" link at the bottom of `/auth` pointing to `/front-desk-login`.
- Kiosk "Lock" button routes signed-in front-desk users to `/front-desk-login` on sign-out.

## Verification (I'll do this before saying it's done)

Using a test front-desk account you create, I'll drive Playwright to:
- Sign in at `/front-desk-login` → lands on `/kiosk/reception`.
- Navigate to `/admin` → silently bounces back to `/kiosk/reception`.
- Try signing in as an admin account on the same page → rejected with the correct error.
- Screenshot each step.

## Out of scope

- No new tables, no new role.
- No changes to existing admin/manager/other staff permissions.
- No device binding — one shared account or one-per-person, your call.

## Technical notes

- New: `src/pages/FrontDeskLogin.tsx` + route in `src/App.tsx`.
- Edit: `src/components/admin/ProtectedAdminRoute.tsx` (add front-desk-only redirect after roles resolve).
- Edit: `src/components/kiosk/KioskShell.tsx` (hide Admin link + Lock redirect for these accounts).
- Uses existing `useUserRoles` and `AuthContext.signIn`. No backend work.

## After it's built

Create a Supabase user (e.g. `frontdesk@stormwellnessclub.com`), then in `/admin/staff-roles` assign **only** the `front_desk` role. Hand them the `/front-desk-login` URL and their password.
