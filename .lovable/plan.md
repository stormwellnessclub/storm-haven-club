

## Plan: Text (SMS) Automation System

The database tables are already created (`sms_messages`, `marketing_sequences`, `marketing_sequence_enrollments`, `marketing_contacts`). The Twilio secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) are **not yet added** — you will need to enter them before SMS can actually send.

### Step 1: Add Twilio secrets
Request the 3 Twilio secrets via the secrets tool. Nothing works until these are in place.

### Step 2: Create `send-sms` edge function
New file: `supabase/functions/send-sms/index.ts`
- Accepts `{ to, body, contact_id? }` 
- Calls Twilio REST API via HTTP Basic Auth (`AccountSid:AuthToken`)
- Logs the message to `sms_messages` table with status tracking
- Returns `{ success, twilio_sid }` or error

### Step 3: Create `process-marketing-sequences` edge function
New file: `supabase/functions/process-marketing-sequences/index.ts`
- Queries `marketing_sequence_enrollments` where `status = 'active'` and `next_step_at <= now()`
- For each due enrollment, reads the sequence's `steps` JSONB array at `current_step`
- Executes the step: calls `send-email` for email steps, calls `send-sms` for SMS steps
- Advances `current_step`, calculates `next_step_at` based on step delay, or marks `completed`

### Step 4: Add SMS buttons to Marketing Portal UI
- **GuestMarketingTab**: Add an "SMS" button next to each guest's "Email" button (only if phone exists), plus a "Send SMS" bulk action
- **MemberMarketingTab**: Same pattern — SMS button per member row
- **New `ComposeSmsDialog` component**: Simple dialog with phone number, message body (160 char counter), and send button that invokes `send-sms`

### Step 5: Add `config.toml` entries
Register `send-sms` and `process-marketing-sequences` in the config.

### Files
- **Create**: `supabase/functions/send-sms/index.ts`
- **Create**: `supabase/functions/process-marketing-sequences/index.ts`
- **Create**: `src/components/admin/marketing/ComposeSmsDialog.tsx`
- **Modify**: `src/components/admin/marketing/GuestMarketingTab.tsx` — add SMS buttons
- **Modify**: `src/components/admin/marketing/MemberMarketingTab.tsx` — add SMS buttons
- **Modify**: `supabase/config.toml` — register new functions

