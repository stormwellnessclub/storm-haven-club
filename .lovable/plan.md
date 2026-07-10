## Issue

Sign-in fails because the auth account `frontdesk@stormwellnessclub.com` does not exist in the database yet — the signup at `/auth` didn't go through (no row in `auth.users`, and the 04:34 log shows `invalid_credentials`).

## Fix

I'll create the account server-side so you don't have to wrestle with the signup form, then lock it to the front desk role.

### Steps

1. **Create the auth user** via a one-off migration using `auth.admin`-equivalent SQL:
   - Email: `frontdesk@stormwellnessclub.com`
   - Password: `Frontdesk18340`
   - `email_confirmed_at` set immediately (no confirmation email needed)
2. **Assign role**: insert a single row into `public.user_roles` with `role = 'front_desk'` for that user. No other roles.
3. **Verify**:
   - Confirm the row exists in `auth.users` with `email_confirmed_at` populated.
   - Confirm exactly one `user_roles` row: `front_desk`.
4. **Hand-off instructions**: log in at `https://stormwellnessclub.com/front-desk-login` with the credentials above → lands on `/frontdesk` (Reception), still gated by the shared kiosk PIN + personal clock-in PIN.

### Not changing

- No frontend files touched.
- No changes to `/auth`, `/front-desk-login`, or the `/frontdesk` shell — those are already working from the prior phase.