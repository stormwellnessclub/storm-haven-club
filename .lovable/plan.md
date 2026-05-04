# Fix SMS toggle visibility + backfill missing contact data

## What's wrong

**Issue 1 — Toggle is missing from the member portal**
The SMS opt-in toggle currently only exists in two places:
- `/portal/profile` (non-member portal)
- The public membership application form

It's NOT on `/member/profile`, which is where actual members go. That's why you can't find it.

**Issue 2 — Phone numbers aren't where SMS needs them**
The `send-sms` function reads phone + opt-in from the `profiles` and `non_member_profiles` tables. Current data:

| Table | Total rows | With phone | Opted in |
|---|---|---|---|
| profiles | 618 | 31 | 0 |
| non_member_profiles | 393 | 50 | 0 |
| members | 179 | 179 | — (no opt-in column) |
| membership_applications | 215 | 215 | — (no opt-in column) |

Phones collected during application and stored on `members` were never copied into `profiles`. So even if a member opts in, there's no number to text.

## Plan

### 1. Add SMS toggle to `/member/profile`
Mirror the same card already used in `/portal/profile`:
- Reuse `SMS_DISCLOSURE_TEXT` and `SMS_DISCLOSURE_VERSION` from `SmsConsentCheckbox`
- Switch writes to `profiles.sms_opt_in / sms_opt_in_at / sms_opt_in_source` (source = `member_portal_toggle`)
- Block toggling on if `phone` is empty (toast asking to add phone first)
- Log every change to `sms_consent_log` with user_agent + disclosure version
- Place it as a new "SMS Notifications" card under the existing profile form

### 2. Backfill phone numbers into `profiles`
One-time SQL migration:
```sql
-- Copy phone from members → profiles where profiles.phone is missing
UPDATE profiles p
SET phone = m.phone
FROM members m
WHERE p.id = m.user_id
  AND m.phone IS NOT NULL AND m.phone <> ''
  AND (p.phone IS NULL OR p.phone = '');

-- Copy phone from membership_applications → profiles by email match
UPDATE profiles p
SET phone = a.phone
FROM membership_applications a
WHERE LOWER(p.email) = LOWER(a.email)
  AND a.phone IS NOT NULL AND a.phone <> ''
  AND (p.phone IS NULL OR p.phone = '');

-- Copy phone from membership_applications → non_member_profiles by email
UPDATE non_member_profiles n
SET phone = a.phone
FROM membership_applications a
WHERE LOWER(n.email) = LOWER(a.email)
  AND a.phone IS NOT NULL AND a.phone <> ''
  AND (n.phone IS NULL OR n.phone = '');
```

Expected after backfill: ~179 members get phones on `profiles` + however many applications match by email.

### 3. Keep them in sync going forward
Add a database trigger so future inserts/updates to `members.phone` and `membership_applications.phone` automatically populate the matching `profiles` row when its phone is empty. Prevents drift.

### 4. About opt-in counts (0 / 0)
Nothing to backfill here — opt-in must be explicit user consent (legal requirement for A2P 10DLC). After step 1, members will see the toggle and can opt in. We do NOT auto-opt-in anyone.

If you want to drive opt-ins, the right next step is a one-time email blast: "We now offer text reminders — log in and enable SMS." I'd queue that as a separate task.

## What you'll be able to do after this

- Log into `/member/profile` → see the SMS Notifications card → toggle on
- Test SMS will actually have a phone number to send to for any of the 179 active members
- New applications and member edits keep `profiles.phone` synced automatically

## Out of scope (not doing now)

- Adding SMS opt-in to `members` or `membership_applications` tables — unnecessary, `profiles` is the source of truth for `send-sms`
- Bulk opt-in email campaign — separate task
- Auto-opting anyone in — illegal under TCPA / 10DLC rules
