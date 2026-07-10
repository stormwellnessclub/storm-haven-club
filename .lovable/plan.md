## Goal
Fix the front desk login so `frontdesk@stormwellnessclub.com` can sign in at `/front-desk-login` and land in the separate Front Desk dashboard.

## Plan
1. **Verify the backend auth account**
   - Check whether `frontdesk@stormwellnessclub.com` exists.
   - Confirm the account is email-confirmed and not disabled.

2. **Repair the password/sign-in state**
   - If the account is missing or malformed, recreate/repair it through an approved backend migration.
   - Reset the password to the intended temporary password.
   - Ensure the email is confirmed so the login page does not require an email confirmation step.

3. **Verify role access**
   - Confirm the user has exactly one staff role: `front_desk`.
   - Remove/avoid any admin, manager, or other staff roles that would cause `/front-desk-login` to reject the account.

4. **Check the login route behavior**
   - Confirm `/front-desk-login` signs the account in, verifies the role, unlocks the kiosk gate for that session, and redirects to `/kiosk/reception` or the intended front desk dashboard route.

## Not changing
- No admin permissions will be added to this account.
- No changes to public/member login unless the front desk flow requires a small bug fix.