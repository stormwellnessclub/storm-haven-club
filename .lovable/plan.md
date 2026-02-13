

## Post-Visit Guest Feedback Email System

### What You'll Get

**1. Feedback Email (sent automatically the day after a guest visits)**

Here's a preview of the email content:

---

**Subject:** How Was Your Visit to Storm Wellness Club?

Dear [Guest Name],

Thank you for visiting Storm Wellness Club yesterday. We hope you enjoyed your time with us.

We'd love to hear about your experience -- what stood out, what you enjoyed most, and anything we could do better. Your feedback helps us continue to elevate the experience for everyone who walks through our doors.

Simply reply to this email with your thoughts -- we read every response.

**[Book Another Visit]** button linking to /guest-pass

*If you're interested in making Storm Wellness Club part of your routine, we'd love to tell you more about membership.*

**[Explore Membership]** button linking to /memberships

Warmly,
Storm Wellness Club

---

Styled with the same branded template (Smoked Umber header, gold accents, Georgia font) as all other Storm emails.

**2. "Feedback Sent" indicator in the admin Guest Passes page**
- A small mail icon badge appears next to guests who have received the feedback email
- Visible in the guest pass table rows and in the Guest Detail Sheet
- Shows the date/time the feedback email was sent

**3. Guest profile access**
- Currently the `guest_passes` table stores all guest data (name, email, phone, gender, interests, notes, visit history)
- The Guest Detail Sheet already shows this as a "profile" when you click on a guest row
- I'll add a direct "View Profile" button to the table rows to make this more discoverable
- I'll also add a "Send Feedback Email" manual trigger button in the Guest Detail Sheet so staff can send it on demand (not just via automation)

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `feedback_email_sent_at` (timestamptz) column to `guest_passes` |
| `supabase/functions/send-email/index.ts` | Add `guest_visit_feedback` email template |
| `supabase/functions/process-guest-feedback-emails/index.ts` | New function: queries eligible guests and sends feedback emails |
| `supabase/config.toml` | Register the new function |
| `src/pages/admin/GuestPasses.tsx` | Add feedback sent indicator (mail icon) to table rows |
| `src/components/admin/GuestDetailSheet.tsx` | Add "Feedback Email Sent" status display and manual "Send Feedback" button |

### Technical Details

- The scheduled function finds guests where `status = 'exhausted'` (checked in), `used_at` was yesterday, `guest_email` is not null, `feedback_email_sent_at` is null, and `no_show` is not true
- After sending, it stamps `feedback_email_sent_at` to prevent duplicates
- The manual send button in the detail sheet lets staff trigger the email for any guest with an email address
- The function will be registered and ready for a daily cron schedule (10:00 AM recommended)

