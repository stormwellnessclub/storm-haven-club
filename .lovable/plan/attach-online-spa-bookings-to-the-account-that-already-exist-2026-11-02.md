# Attach online spa bookings to the account that already exists

## What we found
- Zainab Alsaid has had an account since Sep 22 (bodybynala1@gmail.com). Her Sep 22 massage (completed) is saved to that account.
- She booked Wednesday's Prenatal Massage while signed out, so the booking was saved under her email only and isn't attached to her account. Staff screens don't show it with her history, and her portal won't list it.
- Today, a signed-out booking only gets attached when a brand-new account is created with that email. Nothing attaches it when the account already exists.

## Fix
1. When a signed-out guest pays for a spa booking, look for an existing account with the same email (ignoring capital letters). If there is one, save the booking to that account so it appears in her history and portal. Contact details and payment stay the same.
2. On the confirmation screen and in the email, people who already have an account see "Sign in to view your booking" instead of "Set up your account".
3. One-time cleanup: attach Zainab's Nov 4 booking, plus any other past guest bookings whose email matches an existing account, to that account. Nobody gets an email or text.
4. Staff spa schedule: when a booking belongs to an account, show the account holder's name (as it does for her Sep 22 visit) with a small "Booked online" note.

## Technical details
- `spa-guest-checkout`: during reserve, if there is no signed-in user, look up `profiles.user_id` with `lower(email)` = guest email and set `user_id` on the appointment. The intake/waiver capability links keep working, and the forms owner becomes `a.user_id`.
- The follow-up/email template branches on whether the account exists (returned flag `hasAccount`).
- Data backfill: `update spa_appointments set user_id = p.user_id from profiles p where user_id is null and lower(guest_email)=lower(p.email)`.
- Add a test for the email-match linking rule (case-insensitive, unique match only).
