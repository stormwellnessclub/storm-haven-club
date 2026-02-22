

## Fix: Add Send Email Button to Pending Registrations Table

### The Problem

The "Pending Registrations" table on the main Non-Member Accounts page shows "Not Sent" for Samar and Nada, but there's no button to actually send the email from that table. The send button only exists inside the collapsed "Bulk Pre-Register" section, which you have to open separately.

### The Fix

Add a "Send" button column to the Pending Registrations table so you can send activation emails directly from the main view -- no need to dig into the collapsible section.

Changes:
- Add a send email mutation directly in `NonMemberAccounts.tsx`
- Add a "Send All" button in the card header for unsent emails
- Add an individual send button (mail icon) on each row where the email hasn't been sent yet
- Once sent, the button disappears and the badge updates to show the sent date

### Technical Details

| File | Change |
|------|--------|
| `src/pages/admin/NonMemberAccounts.tsx` | Add `sendEmailMutation` (calls `send-email` edge function and updates `email_sent_at`). Add a "Send All" button next to the card title. Add a new table column with an individual send button per unsent row. |

No database changes needed -- the `email_sent_at` column already exists.
