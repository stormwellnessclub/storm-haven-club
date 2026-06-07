## Goal

1. Force SMS opt-in for non-member portal too.
2. Add email + SMS for spa appointment confirmations & reminders (and waitlist join), for both members and non-members.
3. Give you a single admin screen showing every word of every automated SMS that goes out.
4. Confirm/extend the bulk SMS blast tool you already have.

---

## 1. Non-member portal gate

New component: `src/components/portal/NonMemberSmsOptInGate.tsx` — mirrors `SmsOptInGate` but reads/writes `non_member_profiles`.

- Non-dismissible modal blocking the entire `/portal/*` shell when `sms_opt_in !== true`.
- Single "Enable SMS Alerts" CTA. Routes to `/portal/profile` if no phone on file.
- Respects 30-day explicit opt-out window.
- Mounted in `src/components/portal/PortalLayout.tsx` directly after the existing `PortalPhoneGate` check (phone-first, then SMS gate).

Tiny update to `src/hooks/useNonMemberProfile.ts` to surface `sms_opt_in` / `sms_opt_in_at` / `sms_opt_out_at` / `sms_opt_in_source` on the type and select.

---

## 2. Spa appointment notifications (email + SMS, members + non-members)

Currently `useSpaBooking.ts` sends **nothing** — no email, no SMS, no reminder. I'll wire all three.

### 2a. New: spa confirmation on booking
Inside the existing `useSpaBookAppointment` mutation success path:
- After insert into `spa_appointments`, look up contact (try `profiles` first, fall back to `non_member_profiles`) by `user_id` to get `email`, `phone`, `sms_opt_in`.
- Fire `send-email` (`type: 'spa_appointment_confirmation'`) and `send-sms` (`templateKey: 'appointment-confirmation'`) in parallel, gated by `sms_opt_in`.
- Both already exist in the registry. Variables: `{ service, date, time, provider }`.

New email template added to `send-email`: `spa_appointment_confirmation` — brand-consistent with existing class confirmation, signed "The Storm Wellness Club Team".

### 2b. New: spa 24-hour and 2-hour reminders
New edge function: `supabase/functions/send-spa-reminders/index.ts`
- Queries `spa_appointments` where `status = 'confirmed'`, joining staff for provider name.
- Sends `appointment-reminder-24h` for appts ~24 hrs out, `appointment-reminder-2h` for appts ~2 hrs out, in `America/Chicago` (matches `mem://features/classes/timezone-policy`).
- Idempotent via new columns `reminder_24h_sent_at` / `reminder_2h_sent_at` on `spa_appointments` (migration).
- Sends both email and SMS in parallel; SMS gated by recipient `sms_opt_in`.

Two new pg_cron entries (every 15 min for 24h reminder, every 5 min for 2h reminder) — added via `supabase--insert` SQL with project URL + anon key, per cron policy.

### 2c. Spa cancellation
Hook up cancellation in `useSpaBooking.ts` (already exists, just no notify): send `appointment-confirmation` style cancellation email + SMS template `class-booking-cancellation` reused with spa-friendly variables. (Optional polish; included.)

### 2d. Waitlist join confirmation (classes)
Currently only `notify-waitlist` sends on **promotion**. I'll add a small email+SMS on `useBooking.ts`'s waitlist-join path:
- Email type: `waitlist_joined`
- New SMS template: `waitlist-joined` → `Storm: You're on the waitlist for {{className}} on {{date}} at {{time}}. We'll text if a spot opens.`

Works for members and non-members (same waitlist table).

---

## 3. Centralized SMS language viewer

The hardcoded SMS strings live inside `supabase/functions/send-sms/index.ts`. I'll lift them into a shared registry the admin UI can read from.

- New file: `src/lib/smsTemplates.ts` — exports a `SMS_TEMPLATES` array with `{ key, label, category, body, sampleVariables, triggers }` for every template currently in send-sms (14 templates).
- The edge function still owns the actual renderer (faster, no extra DB hop), with a clear "MUST MIRROR src/lib/smsTemplates.ts" header comment. Both files stay in sync.

New admin tab in `src/pages/admin/Marketing.tsx`: **"SMS Templates"** (next to existing "Email Templates").
- For each template: shows the exact body text, where it fires from (trigger description), example rendered with sample variables, character count + Twilio segment count.
- Read-only with a "Request edit" note explaining why these are code-controlled (deliverability + compliance).
- Lets you audit every word that goes out without me having to send screenshots.

---

## 4. Bulk SMS blast

This **already exists** at `/admin/marketing → SMS Blast` tab — and you've used it before via `mem://admin/marketing/automation-hub`. I'll do two small upgrades:

- Add a **"Campaigns"** preset section above the compose box with one-click templates for common notices: "Holiday hours", "Class cancellation (mass)", "New schedule live", "Membership promotion", "Event invite".
- Confirm the existing audience filters cover **non-members** (currently it pulls from `profiles` only). Extend the audience picker to optionally include `non_member_profiles` (class-pass holders) — gated by `sms_opt_in`.

---

## Files

**New**
- `src/components/portal/NonMemberSmsOptInGate.tsx`
- `supabase/functions/send-spa-reminders/index.ts`
- `src/lib/smsTemplates.ts`
- `src/components/admin/marketing/SmsTemplatesTab.tsx`

**Modified**
- `src/components/portal/PortalLayout.tsx` — mount the gate
- `src/hooks/useNonMemberProfile.ts` — expose sms_opt_in fields
- `src/hooks/useSpaBooking.ts` — confirmation + cancellation notifies
- `src/hooks/useBooking.ts` — waitlist join notify
- `supabase/functions/send-sms/index.ts` — add `waitlist-joined` template
- `supabase/functions/send-email/index.ts` — add `spa_appointment_confirmation`, `spa_appointment_reminder`, `waitlist_joined` types
- `src/pages/admin/Marketing.tsx` — mount new tab
- `src/components/admin/marketing/SmsBlastTab.tsx` — campaign presets + non-member audience option

**Migrations**
- Add `reminder_24h_sent_at`, `reminder_2h_sent_at` columns to `spa_appointments`.

**pg_cron (via supabase--insert)**
- Spa 24h reminder cron (every 15 min)
- Spa 2h reminder cron (every 5 min)

---

## Out of scope
- Email templates for spa **cancellation by admin** mass-flow (admin spa ops already has its own confirm dialog).
- Backfilling past spa appointments with reminder cron history.
- Editing SMS template text from the admin UI (read-only by design for compliance — ping me and I'll change the code).
