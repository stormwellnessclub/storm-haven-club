

## Track Cancellation Email Sent Status

### What This Does
Adds a visible indicator showing whether a cancellation notice email has been sent to a member, and when. This helps you quickly see who has already been notified without having to guess or check email logs.

### How It Works
- A new timestamp field is added to each member's record to store when the cancellation email was sent
- After a cancellation email is successfully sent, the timestamp is automatically saved
- A small badge appears next to the "Send Cancellation Notice" button (or in the member info area) showing "Cancellation Notice Sent" with the date
- This follows the same pattern already used for tracking activation emails (`activation_email_sent_at`)

### Technical Details

**1. Database Migration**
Add a `cancellation_email_sent_at` column to the `members` table:
```sql
ALTER TABLE members ADD COLUMN cancellation_email_sent_at timestamptz DEFAULT NULL;
```

**2. Modify `src/pages/admin/MemberDetail.tsx`**
- After successfully sending the cancellation email (line ~966), update the member record:
  ```
  UPDATE members SET cancellation_email_sent_at = now() WHERE id = member.id
  ```
- Also update in the `handleCancelMembership` flow when the email checkbox is checked
- Display a badge/indicator near the Send Cancellation Notice button showing the sent date (e.g., "Sent Feb 10, 2026") when `cancellation_email_sent_at` is not null
- The button label changes to "Resend Cancellation Notice" if already sent

**3. Modify `src/pages/admin/Members.tsx`** (Members list)
- Show a small mail icon or badge in the cancelled members table rows for those who have received the notice, so you can scan the list at a glance
