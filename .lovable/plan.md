## What you'll get

A real SMS control center inside `/admin/marketing` with picture (MMS) support. After this ships you'll be able to:

- Send a test SMS/MMS to your own phone in 2 clicks
- Send an SMS/MMS to any individual member or non-member
- Run a bulk SMS/MMS blast to a filtered audience with cost estimate
- View a full log of every SMS the system has ever sent
- Attach up to 10 images per message (MMS), with size warnings

---

## 1. New "SMS" tab in `/admin/marketing`

Adds a third `<TabsTrigger>` next to **Guests** and **Members**. The tab contains four stacked cards:

### a. Send Test SMS (top card)
- Phone field pre-filled with logged-in admin's phone (editable)
- Message textarea + image picker
- Single **Send Test** button
- On success: shows Twilio SID, status, delivery timestamp inline

### b. Send to Individual
- Search-as-you-type combobox over `members` + `non_member_profiles` (name, email, phone)
- Selecting a result opens the same upgraded `SendSmsDialog`

### c. Bulk SMS Blast
- **Audience filters:** status (active / frozen / all opted-in) + tier + tag
- **Live recipient count** with breakdown ("23 opted-in, 4 skipped: no phone, 2 skipped: blocked")
- **Compose box** with `{{firstName}}` variable, character + segment counter
- **Image attachments** (drag-drop, up to 10)
- **Cost estimate** ("23 × MMS @ $0.02 = $0.46")
- **Confirmation dialog** before send
- **Per-recipient results table** after send (sent / failed / Twilio SID)
- Hard-blocks anyone with `sms_opt_in != true` or in `blocked_persons`

### d. SMS Send Log
- Table from new `sms_send_log` rows: timestamp, recipient name + phone, body preview, media count, status, Twilio SID
- Filters: date range, status (sent/failed), recipient name
- Click row → drawer with full body, all media thumbnails, full Twilio response

---

## 2. MMS (image) support

### Storage
- New public-read storage bucket **`sms-media`**
- RLS: only admins/staff can INSERT; public SELECT (Twilio fetches images by URL)

### Edge function update (`send-sms`)
- Accept new `mediaUrls: string[]` field (max 10)
- Pass each as repeated `MediaUrl` form param to Twilio's `/Messages.json`
- Auto-routes to MMS when `mediaUrls.length > 0`, falls back to SMS otherwise
- Logs media URLs + count into existing `sms_send_log` table (add `media_urls jsonb` column)

### UI
- Image picker integrated into `SendSmsDialog` (drag-drop + file input)
- Uploads to `sms-media` bucket, shows thumbnail strip with remove buttons
- Warns when any file >1.2 MB ("Carriers may compress this image")
- Cost line in dialog footer: "1 MMS segment ≈ $0.02" vs "1 SMS segment ≈ $0.0079"

---

## 3. Admin sidebar shortcut

Add an **SMS** link under "Marketing" in the admin sidebar that deep-links to `/admin/marketing?tab=sms` for one-click access.

---

## Technical details

- **New components:**
  - `src/components/admin/marketing/SmsBlastTab.tsx` (the whole tab)
  - `src/components/admin/marketing/SmsTestCard.tsx`
  - `src/components/admin/marketing/SmsSendLogTable.tsx`
  - `src/components/admin/SmsMediaPicker.tsx` (reusable upload + thumbnail strip)
- **Updated:** `src/components/admin/SendSmsDialog.tsx` (add media picker, cost line), `src/pages/admin/Marketing.tsx` (new tab), `supabase/functions/send-sms/index.ts` (mediaUrls), admin sidebar
- **Migration:**
  - Create bucket `sms-media` (public-read, admin-insert RLS)
  - Add `media_urls jsonb`, `media_count int default 0` columns to `sms_send_log`
- **Reused:** existing `send-sms` consent gate, `sms_opt_in` check, `blocked_persons` filter, `sms_consent_log`
- **Cost constants** (US 10DLC 2026 baseline): SMS ≈ $0.0079/segment, MMS ≈ $0.02/segment. Stored in `src/lib/smsCosts.ts` for easy tuning.
- **Concurrency for blast:** sends in batches of 10 in parallel via `Promise.allSettled`, idempotency keys per recipient, full results returned to client.

---

## Out of scope (explicit, won't be built in this pass)

- **RCS / iMessage Business / WhatsApp** — these are not MMS. They require separate Twilio brand registration + Apple/Google approval (2–4 weeks). If you want true rich messaging with buttons and your business name as sender, that's a separate plan.
- **Scheduled SMS / drip automation** — already tracked under Automation Hub.
- **Two-way SMS inbox** — inbound webhook exists, but UI not in this build.

---

## Reality checks

- Your Twilio number must be MMS-capable (most US 10DLC long-codes are; toll-free varies). I'll add a one-time check that surfaces an inline warning in the SMS tab if Twilio rejects MMS sends.
- Carriers compress images regardless of source resolution. Keeping files ≤1.2 MB / 1280px gives best delivery rates. Anything bigger may be downsampled or dropped by some carriers.
- MMS to international (non-US/Canada) recipients typically arrives as an SMS with a link, not the embedded image. This is a carrier limitation — no software fix exists.

---

Approve and I'll switch to build mode and ship all of the above in one pass.
