# Twilio Fallback Webhook

Add a dedicated fallback endpoint Twilio will hit only when the primary `twilio-inbound` webhook fails or times out. Logs failures for auditing and always returns 200 so the sender never sees a Twilio error.

## Changes

**1. New edge function: `supabase/functions/twilio-fallback/index.ts`**
- Public (`verify_jwt = false`), POST-only
- Parses Twilio's form-encoded body (`From`, `Body`, `MessageSid`, `ErrorCode`, `ErrorUrl`)
- Inserts row into `sms_messages`:
  - `direction: 'inbound'`
  - `status: 'failed'`
  - `twilio_sid`, `error_code` populated
  - `metadata: { fallback: true, original_endpoint: 'twilio-inbound', error_url, note }`
- Wrapped in try/catch — always returns HTTP 200 with empty TwiML (`<Response/>`) no matter what
- Does NOT process STOP/HELP/START — that's the primary's job; fallback is purely defensive logging

**2. Update `supabase/config.toml`** — append `[functions.twilio-fallback]` block with `verify_jwt = false`

**3. Deploy** the new function automatically

## Twilio Configuration (after deploy)

In Messaging Service → Integration → "Send a webhook" section, paste into the **Fallback URL** field:
```
https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/twilio-fallback
```
Method: **HTTP POST** → Save.

## Auditing

To spot when the primary failed and the fallback caught messages:
```sql
SELECT created_at, phone, message_body, error_code, metadata
FROM sms_messages
WHERE metadata->>'fallback' = 'true'
ORDER BY created_at DESC;
```

Approve and I'll create the function and update the config.
