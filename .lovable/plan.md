Fix the front desk/admin session conflict by removing the real account login from front desk mode and making it a device/PIN-only workspace.

Plan:
1. **Remove front desk account auto-login behavior**
   - Stop `/front-desk-login` from signing into the shared browser auth session.
   - Stop it from automatically redirecting when any existing user is already signed in.
   - Keep it as a front-desk unlock screen that uses the kiosk PIN only, then opens `/frontdesk`.

2. **Make front desk mode independent per tab**
   - Continue using `sessionStorage` for front desk unlock state, since it is tab-specific.
   - Do not use the global auth session for front desk access, so opening admin in another tab will not inherit the front desk account.
   - Logging out of admin will no longer close or sign out the front desk tab.

3. **Prevent front desk lock from signing out admin**
   - Update kiosk/front desk lock buttons so they only clear the local front desk/kiosk unlock flag.
   - Remove the forced auth sign-out tied to front-desk-only accounts.

4. **Keep admin protected normally**
   - Admin routes will still require a real admin login.
   - Front desk routes remain restricted by the kiosk/device PIN and their limited front desk UI, not the admin session.

5. **Verify the workflow**
   - Open/unlock front desk in one tab.
   - Open `/admin` in another tab and confirm it asks for admin login instead of auto-entering as front desk.
   - Confirm admin logout does not lock or close the front desk tab.