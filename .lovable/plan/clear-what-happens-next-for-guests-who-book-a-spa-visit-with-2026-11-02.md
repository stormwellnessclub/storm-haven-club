# Clear "what happens next" for guests who book a spa visit without an account

## What a guest sees today
- At the very bottom of the card step there is a small unchecked box: "Create my account (optional)". Most people skip it.
- If they tick it, the account is made silently after the booking. If it fails, a small pop-up says so and disappears. If email verification is needed, they get a separate verification email with no context.
- The booking itself sends no account-setup email or text. So a guest who skipped the box has no clear path later, and if they try "Sign in" or "Forgot password" it fails because no account exists (same as Liliane).

## What we will change
1. **Booking confirmation screen** gets one clear "Next steps" card:
   - Step 1: Your appointment is booked (date, time, therapist).
   - Step 2: Complete your intake and waiver (button).
   - Step 3: Set up your account to manage this visit - one password box, email already filled in. If they already ticked the box, this shows "Account created - check your email to confirm".
2. **Move the account option out of the payment step.** The card step only takes payment, which removes clutter right where people were getting errors. Account setup happens on the confirmation screen, after the booking is safe.
3. **Confirmation email and text** for guests include a "Set up your account" link that opens a page with their email pre-filled, so they only choose a password. The link is tied to that booking.
4. **Sign-in page help:** when someone tries to sign in or reset a password with an email that has a booking but no account, show "We found your booking - set up your account" instead of a confusing error.
5. When the account is created, the booking, intake, waiver and card automatically show in their portal (this linking already exists; we will confirm it works end to end).

## How we will check it
- Run a full signed-out booking on a phone-size screen with test card details, skip account setup, then use the email link to create the account and confirm the booking shows in the portal.
- No real clients contacted, no real cards charged.

## Technical details
- `SpaGuestCheckout.tsx`: remove the createAccount/password block; reserve-only flow.
- New post-booking "Next steps" panel in `SpaBookingModal.tsx` with inline `supabase.auth.signUp` (email locked to booking contact, redirect to `/portal`).
- `spa-guest-checkout` reserve: include an account-setup link (`/auth?mode=signup&email=...&booking=...`) in confirmation email and consent-checked `send-sms` text.
- Auth page: prefill + lock email from query; on sign-in/reset failure, call a small lookup (by capability token, not by email) to offer signup.
- Verify the existing profiles trigger links `guest_email` appointments and guest capabilities on verified signup.
