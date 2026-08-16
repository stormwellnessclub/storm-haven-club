# Fix: reminder email sender has no real auth check

## What the finding actually means

The `send-application-reminder` function is the tool your admin page uses to email someone "you started an application, come finish it."

Its permission check is written inside the branch that only handles browser preflight requests, so on a real send request the check is skipped entirely. That means anyone on the internet who knows the endpoint could make it send that club-branded email to any address, and bump the "reminder sent" counter on records they name by ID.

**It does not affect application submissions.** Nothing about intake, storage, or the admin list of applications runs through this function. You are still getting every submitted application.

## What to change

In `supabase/functions/send-application-reminder/index.ts`:

1. Move the auth check out of the `OPTIONS` branch so it runs on every real request, before any email is sent.
2. Use staff authentication (`requireStaff`) rather than the internal-task token, since this function is triggered by an admin clicking "Send Reminder" in the browser, not by a cron job. The current trusted-caller check would reject the admin UI once it actually runs.
3. Keep the OPTIONS preflight response returning CORS headers with no auth, as required by browsers.
4. Validate the request body (email format, name length, optional attempt id as a UUID) and return 400 on bad input instead of throwing.

Then redeploy the function and confirm the Abandoned Applications tab still sends reminders successfully as an admin.

## Result

- Only signed-in staff can trigger reminder emails.
- Anonymous callers get a 401 with no email sent.
- Admin "Send Reminder" and bulk send keep working unchanged.
