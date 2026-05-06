# Fix "Failed to send" on Activation Email

## Root cause

Edge Function logs from `send-email` show:

```
Processing email type: member_activation_setup for: szapfe112@gmail.com
Error sending email: Unknown email type: member_activation_setup
```

In `supabase/functions/send-email/index.ts`, `member_activation_setup` is listed in the `type` union (line 52), but there is **no matching `case 'member_activation_setup':` block** in the switch statement. The request falls through to the default branch which throws "Unknown email type", so the function returns an error and the admin UI shows "Failed to send".

## Fix

1. Add a `case 'member_activation_setup':` branch in `supabase/functions/send-email/index.ts` that builds the activation-setup email (subject + branded HTML).
   - Inputs from `data`: `name`, `activationUrl` (or `loginUrl`), optionally `tempPassword` / `setupInstructions`.
   - Match the visual style of the other Storm Wellness templates in the same file (gold/black header, serif heading, CTA button, signed "The Storm Wellness Club Team").
   - Include a clear CTA button to the activation/setup link and fallback plain URL.

2. Redeploy the `send-email` function so the new case is live.

3. Verify by re-clicking "Send Activation Email" in the admin UI for a test member and confirming:
   - HTTP 200 from the function
   - Row appears in `email_send_log` (or Resend logs) as `sent`
   - Email arrives in inbox

## Files touched

- `supabase/functions/send-email/index.ts` — add the missing `case` only. No other email types or logic are changed.

No DB migrations, no UI changes, no other edge functions affected.
