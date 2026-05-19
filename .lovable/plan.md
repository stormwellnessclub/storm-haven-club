## What's actually happening

When you charge an approved applicant from the Applications page and their card declines, the app already:

1. Calls `send-email` with type `application_card_declined` (the gold "Update Payment Method" email you previewed).
2. Inserts a row into `email_audit_log` with `email_type='application_card_declined'`, `trigger_source='auto_on_decline'`, `application_id=<that app>`.
3. Shows a one-time orange toast: *"Card declined — payment update email sent to …"*.

The Applications table already has an **Email** column that reads from `email_audit_log` and shows the latest email per applicant. Two reasons you don't see a confirmation today:

- **The label map doesn't include `application_card_declined`**, so even when it does log, it renders the raw key in a neutral gray badge that looks identical to "Approval", "Setup", etc. Nothing tells you "this was a decline notice."
- **`email_audit_log` currently has 0 rows for `application_card_declined`** across the whole project. That means either no decline has been auto-fired yet, or the audit insert silently failed (the email send itself can succeed while the audit insert fails — it's wrapped in its own `try/catch` that only `console.warn`s). Either way you have no historical trail.

There is also no log row written when the **email itself fails** — if Resend errors, the toast turns into "Failed to send card-decline email" and disappears, and nothing is recorded.

## The fix

### 1. Always write to `email_audit_log` — success *and* failure
In `sendApplicationCardDeclinedEmail` (src/pages/admin/Applications.tsx ~line 1147):
- Move the audit insert so it runs whether the `send-email` call succeeds or throws.
- On success: `status: 'sent'`.
- On failure: `status: 'failed'` with `error_message` populated.
- This guarantees every charge-decline produces a visible record.

### 2. Make the decline notice unmistakable in the table
In the Email column renderer (~line 2257):
- Add `application_card_declined` to `typeLabels` as **"Card Declined Notice"**.
- Render it in a **red/destructive badge** (matching the `No Email` warning style) with a `CreditCard` icon instead of the neutral gray `Mail` icon.
- If `status='failed'`, show **"Decline Email Failed"** in destructive style with the error in the tooltip so you know to resend.
- Tooltip continues to show the timestamp.

### 3. Add a "Card declined" filter chip
Above the table, add a filter pill next to the existing status filters: **"Card Declined"**. It filters to applications whose latest `email_audit_log` row is `application_card_declined` (sent or failed) and `app.status='approved'`. This gives you a one-click view of "who got charged, declined, and still hasn't paid."

### 4. Surface decline history in the applicant detail/timeline
The applicant row already opens a detail view. Add a small **Charge Attempts** section that lists every `application_card_declined` row from `email_audit_log` for that `application_id` with timestamp + status. This way "was the email sent? when? was it resent?" is answerable at a glance for any applicant, including Ayana-style cases.

### 5. (Optional, recommend) Toast persistence
Bump the auto-decline toast `duration` to ~12s and add an inline **"View applicant"** action so it doesn't disappear before you can act on it.

## Files touched
- `src/pages/admin/Applications.tsx` — audit logging, badge rendering, filter chip, detail section, toast.

No backend or schema changes needed — `email_audit_log` already has the right shape (`email_type`, `status`, `error_message`, `application_id`, `sent_at`, `trigger_source`).

## Out of scope
- The broader fulfillment/reconciliation work for class passes (already shipped last turn).
- Migrating the applicant card-decline email to the new `email_send_log` queue system — not needed for the visibility problem you asked about.