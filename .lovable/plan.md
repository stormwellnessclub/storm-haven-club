## Problem

Three issues to fix:

1. **No admin SMS sender exists.** The `send-sms` edge function is wired up, but there is no admin UI anywhere to actually trigger it — not for one member, not for a group, not as a test.
2. **SMS opt-in toggle is buried.** It only appears at the bottom of `/member/profile`. Members never scroll there. It needs to surface in the top notification bar so it's a one-tap opt-in.
3. **Member's phone doesn't show on `/member/profile` even though admin sees it.** Root cause confirmed by querying the database:
   - 132 members have a linked `user_id` but **no row in `profiles`** at all → form loads blank, SMS toggle has nothing to write to.
   - 47 members have no `user_id` linked yet → can't be helped until they create an auth account, but admin can still text them.

The earlier backfill only updated existing `profiles` rows. It never created missing ones.

---

## Plan

### 1. Backfill missing `profiles` rows (one-time SQL)

For every `members` row where `user_id IS NOT NULL` but no matching `profiles` row exists, INSERT a profile row carrying `id`, `email`, `first_name`, `last_name`, and `phone` from `members`. This unblocks the 132 members whose phone "disappeared" on their own profile page.

Also strengthen the existing `members → profiles` phone-sync trigger so it does an UPSERT (insert if missing, update if blank) instead of update-only.

### 2. Member-side: Promote SMS opt-in into the top notification bar

In `MemberLayout.tsx`, add a new notification item (priority just below activation/payment) that shows when `profile.sms_opt_in !== true`:

```
"📱 Get text alerts for class reminders, waitlist & billing.  [Enable SMS]"
```

`Enable SMS` is a button that:
- If `profile.phone` is missing → toast "Add a phone number first" + link to `/member/profile`.
- If phone is present → opens a small confirmation dialog showing the legal disclosure (reuses `SMS_DISCLOSURE_TEXT`), with **Enable** / **Not now** buttons. Enabling writes `sms_opt_in=true` to `profiles` and logs to `sms_consent_log` (same logic as `SmsToggleCard`).
- Once opted-in (or dismissed for the session), the banner hides.

This makes opt-in 1–2 taps instead of "scroll to the bottom of profile."

### 3. Admin-side: Add a "Send SMS" tool

Two surfaces:

**a) Per-member quick-send** — On the admin member detail sheet (where staff already see phone, billing, etc.), add a "Send SMS" button. Opens a dialog with:
- To: pre-filled with member name + phone (read-only)
- Template dropdown (reuses keys from `send-sms`: test-message, class-reminder, payment-failed, custom-free-text, etc.)
- Message preview
- Big red warning if member has `sms_opt_in=false` ("This member has not opted in. You may only send transactional service messages required for their account.")
- Send button → calls `send-sms` edge function, shows Twilio SID + status on success.

**b) Bulk SMS Blast** — New tab inside `MemberMarketingTab` called **"SMS"**:
- Audience filter: All opted-in members / by tier / by tag / by status (active, frozen)
- Live count of recipients (e.g. "Will send to 23 members")
- Message composer with character count + cost estimate ($0.0079/segment × N)
- Template variables (`{{firstName}}`)
- Hard-blocks anyone where `sms_opt_in != true` or in `blocked_persons`
- Confirmation dialog: "Send to 23 members?  Est. cost $0.18"
- Sends in batches via `send-sms` with unique idempotency keys, reports per-recipient success/failure in a results table.

### 4. Self-service phone fix on member profile

Right now if `profiles.phone` is empty, the form shows blank with no nudge. Add a small inline alert above the phone field if empty:
> "We don't have a phone number on file. Add one to enable SMS class reminders and waitlist alerts."

---

## Technical details

- **Backfill SQL** (single migration):
  ```sql
  INSERT INTO profiles (id, email, first_name, last_name, phone)
  SELECT m.user_id, m.email, m.first_name, m.last_name, m.phone
  FROM members m
  WHERE m.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = m.user_id);
  ```
- **Trigger upgrade**: change `trg_sync_phone_members_to_profiles` to UPSERT.
- **New components**:
  - `src/components/member/SmsOptInBanner.tsx` (used by `MemberLayout`)
  - `src/components/admin/SendSmsDialog.tsx` (per-member)
  - `src/components/admin/marketing/SmsBlastTab.tsx` (bulk)
- **Reuse**: `send-sms` edge function (already deployed), `SMS_DISCLOSURE_TEXT`, `sms_consent_log`.
- **Compliance**: Keeps the existing rule — never auto-opt-in. Bulk blast filters to `sms_opt_in=true` only. Per-member sender allows transactional sends to non-opted-in members but warns staff (legally permitted for service messages under TCPA; marketing requires opt-in).
- **Out of scope** (can do later if you want): scheduled SMS campaigns, two-way SMS chat in admin (the inbound webhook exists but no UI consumes it yet).

---

## Approval needed

Approve and I'll switch to build mode and implement all four sections in one pass.