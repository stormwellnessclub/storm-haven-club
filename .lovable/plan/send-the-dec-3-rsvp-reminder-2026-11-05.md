# Send the Dec. 3 RSVP reminder

1. Load the list of book club people who haven't RSVP'd for Dec. 3 and report the count (email and text).
2. Send one test email to stormfitnessllc@gmail.com with the default wording, then check that it went out.
3. Send the reminder email to everyone on the list. People who unsubscribed are skipped.
4. Send the reminder text to people who agreed to texts and haven't opted out.
5. Report how many were sent, skipped and failed.

Nobody gets either message twice. No changes to the app.

## Technical details
- Uses the existing `send-society-last-call` function with `audience: "rsvp_reminder"` (`list`, then `sendEmail`, then `sendSms`). Its send keys stop repeat sends.
- Texts go through `send-sms` consent checks. Emails go through suppression and unsubscribe handling.
