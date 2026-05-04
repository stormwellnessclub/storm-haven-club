# Plan: SMS Consent System + Privacy Policy Update

## Part A — Privacy Policy (sharpened, nothing removed)

Update `src/pages/Privacy.tsx`:

1. **Section 1 (Parties and Scope)** — expand operating entity language:
   - "Storm Wellness Club ('Storm,' 'we,' 'us,' or 'our') is **operated by Storm Fitness** and owned by SR & D Development LLC. Storm Fitness is responsible for day-to-day operations of the club, including member services, communications, and on-site activities. SR & D Development LLC is the parent ownership entity."
   - Keep all existing SR & D liability protections in Section 5 untouched.

2. **New Section 4a — SMS / Text Messaging Program** (inserted after Disclosure):
   - Categories of messages sent (transactional + informational): class reminders, waitlist alerts, billing notices, account updates, appointment confirmations, membership announcements, café/order ready, kids care urgent alerts, promotional offers (only if opted in).
   - Message frequency varies. Msg & data rates may apply.
   - **Opt-in methods** — list all 5 (membership application, non-member signup, member portal toggle, front desk verbal+written, kiosk).
   - **Opt-out**: Reply STOP to any message, toggle SMS off in Profile, or email admin@stormwellnessclub.com.
   - **HELP**: Reply HELP for support info.
   - **Mobile information sharing clause** (carrier-required language):
     > "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All categories listed above exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties."
   - Link to new `/sms-terms` page.

3. **Sharpen weak sections** (expand without removing):
   - Section 2: add biometric/photo data (member headshots), check-in scan data, geolocation (none collected), device/browser data.
   - Section 3: add specific lawful bases (contract performance, legitimate interest, consent for marketing).
   - Section 4: explicitly name categories of service providers (Stripe — payments; Twilio — SMS; Resend — email; Supabase/Lovable Cloud — hosting & data storage; Google Analytics — usage analytics).
   - Section 6: list specific safeguards (TLS in transit, encrypted at rest, RLS row-level security, role-based access, PCI-DSS compliant payment processor — we never store full card numbers).
   - Section 9: add California (CCPA) and "Do Not Sell" affirmation.

## Part B — New `/sms-terms` page

Create `src/pages/SMSTerms.tsx` — standalone page Twilio reviewers can hit directly, containing:
- Program name, brand (Storm Wellness Club), operator (Storm Fitness)
- Message types & sample messages
- Frequency, rates disclaimer
- All opt-in points with screenshots-of-text descriptions
- STOP/HELP keywords
- Privacy link, contact info
- Mobile-info-not-shared clause (verbatim)

Add route in `src/App.tsx`: `/sms-terms` → `<SMSTerms />`.

## Part C — Database (migration)

Add columns to `profiles` and `non_member_profiles`:
- `sms_opt_in boolean default false`
- `sms_opt_in_at timestamptz`
- `sms_opt_in_source text` — `'application' | 'non_member_signup' | 'portal_toggle' | 'front_desk' | 'kiosk'`
- `sms_opt_out_at timestamptz`
- `sms_opt_out_source text`

New table `sms_consent_log`:
- `id`, `user_id`, `phone`, `action` (`opt_in`|`opt_out`), `source`, `ip_address`, `user_agent`, `disclosure_version`, `created_at`
- RLS: users see own rows; admins see all via `has_any_role`.

## Part D — Consent UI (5 checkpoints)

Add a reusable `<SmsConsentCheckbox>` component with the standard disclosure paragraph + links to `/sms-terms` and `/privacy`. Wire into:

1. **Membership application form** — required-style checkbox next to phone field; writes to `profiles.sms_opt_in*` on submit.
2. **Non-member signup** (`Auth.tsx` signup path) — checkbox; writes to `non_member_profiles.sms_opt_in*` after profile create.
3. **Member portal Profile** (`src/pages/portal/Profile.tsx` + `src/pages/member/Profile.tsx`) — toggle Switch with audit log entry on every flip.
4. **Front Desk / Kiosk reception** — checkbox in walk-in registration flow; source = `front_desk` or `kiosk`.
5. **POS / class pass purchase phone capture** — inline checkbox if phone is being collected for the first time.

All 5 checkpoints write a row to `sms_consent_log`.

## Part E — STOP/HELP webhook + send-sms function

1. **`supabase/functions/twilio-inbound-sms/index.ts`** (new, public):
   - Verifies Twilio signature.
   - Parses inbound `Body`. If matches STOP/UNSUBSCRIBE/CANCEL/END/QUIT → set `sms_opt_in=false`, log opt-out, reply with confirmation.
   - If HELP/INFO → reply with help text + support contact.
   - Other inbound → forward to admin support inbox (existing email conversations system).

2. **`supabase/functions/send-sms/index.ts`** (new):
   - Reusable wrapper around Twilio REST API (Basic Auth — per memory `twilio/direct-api-config`).
   - **Hard guard**: refuses to send to any phone where `sms_opt_in=false` OR `sms_opt_out_at IS NOT NULL` UNLESS message is a critical transactional override (configurable per-call, logged).
   - Logs every send to `sms_outbound_log`.

3. Configure inbound webhook URL in Twilio console (manual step — I'll give you the URL after deploy).

## Part F — Footer + nav

- Add `SMS Terms` link to footer alongside Privacy and Terms.

## Technical notes

- Twilio config already stored via standard connector (`twilio/direct-api-config` memory).
- Disclosure text version stored as constant `SMS_DISCLOSURE_V1` so future wording changes increment cleanly.
- All migrations use validation triggers, not CHECK constraints.
- Memory updates after build: new entries for SMS consent system + privacy policy operator language.

Confirm and I'll build all parts in one pass.