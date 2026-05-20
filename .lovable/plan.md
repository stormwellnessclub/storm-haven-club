## What's already built (just hard to find)

Good news — the auto-email + audit log + resend button **already exist** exactly as I described to you:

- When you click "Charge" on an approved applicant and Stripe declines, `Applications.tsx` automatically calls the `application_card_declined` email and writes a row to `email_audit_log` (success **or** failure).
- The applications table has an **Email column** that shows a red "Card Declined Notice" badge (or "Decline Email Failed") with the timestamp on hover.
- The applicant's detail sheet has a **"Card-Decline Notices"** history section listing every send attempt with status, errors, and a **"Resend now"** button.

## The actual problem

That history section in the detail sheet is wrapped in `{cardDeclineHistoryByApp.get(app.id)?.length > 0 && ...}` — meaning it **only appears if a decline email has already been sent**. So when you open an applicant who hasn't had a decline yet (or where the auto-send somehow didn't fire), there's nothing to see and no button to click. That's why it feels missing.

## Fix

Make the card-decline email panel **always visible** in the applicant detail sheet for approved applicants, so you always have one consistent place to:
- See if a decline notice has ever been sent (and when / status)
- See "Never sent" if it hasn't
- Hit a **Send Card-Decline Email** button manually, anytime

### Changes (one file: `src/pages/admin/Applications.tsx`)

1. **Remove the conditional wrapper** around the "Card-Decline Notices" block (currently line 3017) so the section renders for every approved applicant.
2. **Update empty state**: when `cardDeclineHistoryByApp.get(app.id)` is empty, show a muted "No card-decline notice sent yet" line instead of hiding the section.
3. **Rename the button** dynamically:
   - No history → `Send Card-Decline Email`
   - Has history → `Resend now` (current behavior)
4. **Keep** the existing CreditCard icon, history list rendering, and the `sendApplicationCardDeclinedEmail()` handler — no logic changes, no new backend, no new audit fields.

### Out of scope
- No changes to the email template, the auto-send-on-decline behavior, or `email_audit_log` schema.
- No changes to the row-level Email column badge — it already works.
- The "Resend Card-Decline Notice" dropdown menu item stays as-is (it's a nice shortcut from the list).

Net effect: from any approved applicant's detail panel you'll always see the card-decline email status and a one-click button to send/resend it.