# Hide front desk unlock from the public sign-in page

You're right — the "Front desk mode — unlock with PIN" button currently renders for every visitor on the public `/auth` page. It should not be advertised to members or the public.

## Changes

1. Remove the front desk button and its helper text from the bottom of the sign-in page (`src/pages/Auth.tsx`). Nothing on the public page will mention front desk mode or PIN unlocking.
2. Keep `/front-desk-login` working as a direct, unlisted URL so staff can bookmark it on the desk devices (and it stays `noindex`).
3. Keep the silent guard that catches a typed `frontdesk@...` email and routes it to the PIN screen, but drop the wording that explains the PIN system — it just redirects.

## Technical notes

- Only `src/pages/Auth.tsx` changes. No backend, route, or PIN changes.
- `/front-desk-login` route remains registered and reachable by URL; access is still gated by the kiosk PIN.
