I found two likely reasons this feels like “it’s not working” for returning non-members:

1. **Returning guests with existing accounts are being pushed to create an account again.** If they previously bought/booked classes, their email may already exist, so signup fails and they may not realize they should sign in/reset password.
2. **Guest pass checkout is tied to the logged-in account, not the guest email they type.** If someone signs in with one email but enters a different guest email, the backend uses the signed-in user for payment/block checks and Stripe customer matching, which can confuse returning non-member flows.

Plan:

1. **Improve the account gate on Guest Pass**
   - Change the guest pass account prompt so the primary action is “Sign In” for returning guests.
   - Keep “Create Account” available, but make it clear returning class/guest visitors should sign in or reset password instead of creating another account.
   - Ensure the create-account link explicitly uses signup mode (`/auth?mode=signup&redirect=/guest-pass`).

2. **Improve class pass account guidance**
   - On `/class-passes`, update the unsigned-in prompt text to explicitly say: if you’ve taken classes before, sign in with that email or reset your password.
   - Keep non-member pricing and checkout logic unchanged.

3. **Make auth errors more helpful**
   - In `Auth.tsx`, when signup detects an existing email, change the toast to direct them to sign in or reset password.
   - If sign-in fails, keep the error but make the next step clearer: reset password if they attended before.

4. **Add better checkout error visibility**
   - On Guest Pass and Class Pass checkout errors, show the actual backend message when available and include a “try signing in/reset password” style message for account-related failures.
   - This helps staff understand what the guest hit instead of only “not working.”

Out of scope for this pass:
- I won’t remove the current gender/capacity block or blocked-person enforcement unless you explicitly want that changed.
- I won’t change pricing, waivers, or payment processing.