

## Fix: Complete the List and Add Email-Sent Tracking

### What's Missing

Only 2 of the 10 people were added to the pending imports. These 8 are still missing:

| Name | Email | Phone |
|------|-------|-------|
| Bayan Mehanna | (need from you) | (need from you) |
| Randa Dirani | (need from you) | (need from you) |
| Reem Alhaddi | (need from you) | (need from you) |
| Salma Kazan | (need from you) | (need from you) |
| Summer Hamid | (need from you) | (need from you) |
| Yasmeena Serhane | (need from you) | (need from you) |
| Liana Dawoud | (need from you) | (need from you) |
| Samar Hannawi | (need from you) | (need from you) |

You can add them through the Bulk Pre-Register form. But first, let's make the system better so you can actually see everything.

### Improvements

**1. Add "Email Sent" tracking**

Add an `email_sent_at` column to the `pending_non_member_imports` table. When you click the mail icon, it records the timestamp. This way you'll see exactly who got an activation link and who didn't.

**2. Show pending imports in the main list**

Right now, pending people are hidden inside the collapsible "Bulk Pre-Register" section. We'll add a combined view so the main Non-Member Accounts page shows both:
- Registered accounts (existing behavior)
- Pending imports (with a "Pending" badge and an "Email Sent" / "Not Sent" indicator)

This gives you one unified list instead of having to dig into the collapsible section.

**3. Update the Pending Imports table**

Add visible columns for:
- Phone number
- Email sent status (with timestamp)
- A "Send All" button to email everyone who hasn't been sent one yet

### Technical Details

| File | Change |
|------|--------|
| Database migration | Add `email_sent_at` column to `pending_non_member_imports` |
| `src/components/admin/BulkNonMemberImport.tsx` | Update email mutation to set `email_sent_at`; add phone column and "Send All" button to the pending table; show email-sent indicator |
| `src/pages/admin/NonMemberAccounts.tsx` | Add a "Pending Registrations" summary card and a second table below the main accounts table showing all pending imports with their email-sent status |

