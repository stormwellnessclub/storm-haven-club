# Nadeen's activation: what happened, and a small fix

## What the data shows

- Nadeen's member record (`nadeenwaoun@gmail.com`) is **active**, approved Aug 10, activated Aug 10.
- Her login account was created **tonight at 8:22 PM** and immediately linked to that member record.
- No password-reset email was ever sent to her address (no recovery request on record).

So yes — your understanding is right: **a brand-new member has no login yet.** "Reset password" can't work because there is nothing to reset. She has to sign up with the exact same email used on her application, and the member record links automatically (case-insensitive email match). That already happened for her — she's linked and active now.

## The real problem

The activation email's button says "Complete Your Setup" / "Choose My Start Date" and drops people on the sign-in screen. New members read that as "log in", fail, then try "Forgot password", which silently does nothing. That's the confusion, and it will repeat with every new member.

## Proposed fix (small, copy + routing only)

1. **Activation emails point to sign-up, not sign-in.** Change the activation/setup email links to open the auth page in create-account mode with the email pre-filled, e.g. `/auth?mode=signup&email=...`, and add one line: "First time here? Create your account using the same email you applied with — your membership links automatically."
2. **Auth page honors `mode=signup` and `email=`** — opens on the Create Account tab with the email field pre-populated and read-only-ish hint text.
3. **Reset Password page gets a first-time hint** — under the form: "New member? You need to create your account first." with a link to sign-up. (The reset endpoint intentionally gives no "user not found" feedback for security, so a static hint is the right approach.)

No database or billing logic changes.

## Technical notes

- Email templates: `supabase/functions/send-email/index.ts` — cases `member_activation_setup` / `setup_instructions`, `approval_with_deadline`, `activation_reminder_day3`, `activation_reminder_day5`, `application_approved_locked_date`, `add_card_for_dues` (currently all link to `${BASE_URL}/auth`).
- Auth page: read `mode` and `email` query params to pick the sign-up tab and prefill.
- Reset page: `src/pages/ResetPassword.tsx` — add the helper line only.
- Linking already works via the email-match trigger / `link_member_by_email`; no change needed there.
