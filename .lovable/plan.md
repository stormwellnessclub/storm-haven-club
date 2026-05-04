## Chunk A — SMS Foundation

Goal: stand up the outbound + inbound SMS plumbing so the rest of the marketing plan (transactional wiring, admin console, automation hub) can plug in. SMS is **additive** to email — no email flows are removed or replaced.

### 1. Database — `sms_message_log`

New table to mirror what `email_message_log` does for email:

- `id uuid pk`
- `recipient_user_id uuid null` (references auth user; null for non-members keyed by phone only)
- `recipient_phone text not null` (E.164)
- `direction text not null` check in (`outbound`,`inbound`)
- `template_key text null` (kebab-case, e.g. `class-reminder-24h`)
- `body text not null`
- `twilio_sid text null`
- `status text not null default 'queued'` (queued, sent, delivered, failed, undelivered, received)
- `error_code text null`
- `error_message text null`
- `idempotency_key text null unique` (prevents double sends)
- `metadata jsonb default '{}'`
- `created_at timestamptz default now()`
- `delivered_at timestamptz null`

RLS: admins (`has_any_role` admin/super_admin) full read; users can read their own rows where `recipient_user_id = auth.uid()`; inserts/updates only via service role (edge functions).

Indexes on `recipient_user_id`, `recipient_phone`, `template_key`, `created_at desc`, `twilio_sid`.

### 2. Edge function — `send-sms`

Mirrors the shape of `send-transactional-email`. Inputs:

```
{
  to: { userId?: string, phone?: string },
  templateKey: string,
  variables: Record<string, unknown>,
  idempotencyKey: string,
  metadata?: Record<string, unknown>
}
```

Behavior:
1. Resolve recipient. If `userId` given, look up `profiles` for `phone` + `sms_opt_in` + name. If only `phone`, treat as non-member (must already exist in `non_member_profiles` or `members` with `sms_opt_in=true`).
2. Hard gate: if `sms_opt_in !== true` → log `status='blocked_no_consent'` and return success-noop. Never send without consent.
3. Check `blocked_persons` by email/phone — short-circuit if blocked.
4. Idempotency: if a row already exists with same `idempotency_key`, return that row's status (no duplicate send).
5. Render body from a server-side template registry (kebab-case keys). Initial templates:
   - `class-reminder-24h`, `class-reminder-2h`, `class-cancelled`, `waitlist-promoted`
   - `appointment-confirmation`, `appointment-reminder-24h`, `appointment-reminder-2h`
   - `kids-care-confirmation`, `kids-care-reminder`
   - `payment-failed`, `arrears-balance`
   - `cafe-order-ready`
   - `test-message` (admin diagnostic)
   Each template returns ≤ 320 chars, includes "Reply STOP to opt out" on marketing-flavored ones, and never on transactional-only sends per Twilio rules (transactional already covered by program disclosure).
6. POST to Twilio REST API directly via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` using HTTP Basic Auth (per existing `mem://integrations/twilio/direct-api-config` — bypasses connector gateway). Required secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`. Will request via `add_secret` if missing.
7. Insert into `sms_message_log` with `twilio_sid` + `status='sent'`. On Twilio error, log `status='failed'` with error code/message and return 200 + `{ success:false, error }` (per project policy of HTTP 200 + success flag).
8. CORS headers, JWT validated in code, zod-validated input.

### 3. Edge function — `twilio-inbound` (A2P-required)

Public webhook (no JWT, `verify_jwt=false`). Twilio will POST `application/x-www-form-urlencoded` with `From`, `Body`, `MessageSid`, etc.

- Log inbound row in `sms_message_log` (`direction='inbound'`).
- Normalize body: trim, uppercase, take first word.
- Keyword routing:
  - `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` → set `sms_opt_in=false` on matching `profiles` / `non_member_profiles` row (match by phone, last-10-digits fallback). Insert `sms_consent_log` row with `action='opt_out'`, `source='sms_keyword'`. Reply with the standard confirmation.
  - `START`, `UNSTOP`, `YES` → set `sms_opt_in=true`, log `action='opt_in'`, `source='sms_keyword'`. Reply confirming re-subscription.
  - `HELP`, `INFO` → reply with help text + admin@stormwellnessclub.com.
  - Anything else → log only, no auto-reply (avoid carrier flagging).
- Return TwiML `<Response>` with the reply (`<Message>`) so Twilio sends it natively (no extra API call needed).

### 4. Edge function — `twilio-status`

Public webhook for Twilio `StatusCallback`. Updates `sms_message_log` row matching `MessageSid` with new `status` (`delivered`, `failed`, `undelivered`, etc.) and `delivered_at` when applicable. Used for deliverability reporting later.

### 5. Wiring + secrets

- Confirm/request Twilio secrets via `add_secret` if not already present: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` (E.164) or `TWILIO_MESSAGING_SERVICE_SID` (preferred for A2P).
- Add `supabase/config.toml` blocks for `twilio-inbound` and `twilio-status` with `verify_jwt = false`.
- Provide the user the two webhook URLs to paste into Twilio console (Messaging Service → Integration → Inbound + Status Callback).

### 6. Manual verification (no UI yet)

After deploy, I'll call `send-sms` via `curl_edge_functions` with `template-key: test-message` to my own logged-in user (or an admin-supplied phone) and confirm:
- Row inserted in `sms_message_log` with `status='sent'` + `twilio_sid`.
- Twilio status webhook flips it to `delivered`.
- Replying STOP from the test phone flips `sms_opt_in=false` and logs `sms_consent_log`.
- Replying START re-opts in.

### Out of scope for this chunk (next chunks)

- **Chunk B**: wire `send-sms` calls alongside every existing transactional email (class reminders, waitlist, spa, kids care, payment failed, arrears, café). One `idempotencyKey` per event, e.g. `class-reminder-24h-{sessionId}-{userId}`.
- **Chunk C**: Admin → Marketing → SMS console (single send, bulk to segments, log viewer).
- **Chunk D**: Hook Automation Hub drip steps to `send-sms`.
- **Chunk E**: Twilio console safety toggles (SMS Pumping Protection, US-only Geo Permissions).

Approve and I'll build Chunk A end-to-end in one pass.