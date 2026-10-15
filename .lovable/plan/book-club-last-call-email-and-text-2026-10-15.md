# Book club: last-call email and text

## What exists today
- The only book club message ever sent is the invite email. It went to 132 members on Oct 1.
- You'll find it under Events Portal → Higher Self Society, below the sign-up list.
- No book club text and no last-call message exist yet. That's why you couldn't find them.

## What I'll build
On the same Higher Self Society screen, add a **Last call** box with two parts: email and text.

**Who gets it:** active and frozen members who have **not** signed up yet. People already signed up are skipped. Cancelled members are never included. Anyone unsubscribed, opted out of texts or blocked is skipped.

**Message (draft):**
> Last call for Higher Self Society, our founding reading circle. Sign-ups close this Sunday, Oct. 18, and then members choose our first book together. We'll meet one Thursday evening a month, 7:00 to 9:00 PM. Save your seat: [link]

- The email uses the same maroon and brown style as the invite. It's from admin@stormwellnessclub.com and has the unsubscribe link.
- The text starts with "Storm Wellness Club:" and ends with "Reply STOP to opt out."
- You can edit the wording before sending.

**Before anything goes out:** you'll see the full recipient list with a count, and you can remove people. You can send a test email and a test text to yourself first. Nothing is sent until you press Send. Each person gets each message once only.

**Close sign-ups:** the sign-up form closes on its own at 11:59 PM Detroit time on Sunday, Oct. 18. After that it shows "Sign-ups are closed." Staff can still add people by hand.

## After building
- Publish → Update so the new box shows on stormwellnessclub.com.

## Technical details
- Extend `send-higher-self-society-invite` with a `last_call` mode. It sends through `_shared/marketingEmail.ts` and logs to `email_audit_log` under its own email type, which keeps resends from going out twice.
- Texts are sent as an `sms_campaigns` campaign through `send-sms` (consent enforced, no bypass). The recipient list excludes `higher_self_society_interest` emails.
- New `SocietyLastCallControls.tsx` follows the pattern of `SocietyInviteEmailControls`. It includes the sign-ups-closed setting, which the public form reads.
