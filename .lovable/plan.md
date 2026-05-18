
## Card-Decline Email for Approved Applicants

Adds a new transactional email that fires automatically when an applicant's card declines during the **approval charge** flow. Strictly scoped — not used for recurring dues/membership failures.

### Email Template (final copy)

**Subject:** A small hold on your Storm Wellness Club membership — action needed
**Preview:** Your application has been approved. We need a quick payment update to complete activation.

Body (premium, serif tone, dark header `#312D28`, cream wordmark `#E8DED1`, amber callout `#fef3c7`/`#f59e0b` for the 7-day deadline):

> Dear {first_name},
>
> Wonderful news — your Storm Wellness Club application has been approved. We're looking forward to welcoming you into the Club.
>
> Before we can complete your activation, we ran into a small issue: your card on file was declined when we attempted your initial charge. This is typically due to a daily limit, an expired card, or a routine fraud check from your bank — nothing to be concerned about.
>
> **To complete your activation, please update your payment method:**
> [Update Payment Method] → `/portal/payment-methods`
>
> ⏰ **Your approval is reserved for the next 7 days.** If we don't receive a valid payment method by then, your approval will expire and a new application will be required to rejoin.
>
> Questions? Just reply to this email or give the Club a call — we're happy to help. To update your card, please use the secure link above.
>
> Warmly,
> The Storm Wellness Club Team

### Trigger Scope (important)

Fires **only** from the Applications admin → approval charge flow when Stripe returns a decline on the initial applicant charge. **Will NOT fire** for:
- Recurring monthly dues failures (handled by existing `payment_failed` template via Stripe webhook)
- Annual fee renewal failures on existing members
- POS charges, class pass purchases, or any non-application charge

Enforcement: new dedicated email type `application_card_declined` separate from the existing `payment_failed` type. The Stripe webhook for `invoice.payment_failed` continues to use `payment_failed` and is untouched.

### Where it triggers

In `src/pages/admin/Applications.tsx`, inside the `handleCharge` catch block (around line 1131) — when `data.success === false` or the charge throws a card-decline error during the approval flow (`afterChargeOptions.approveAndSendEmail` is true OR `chargeTarget.status` is being moved to approved). Invokes `send-email` with `type: "application_card_declined"`.

### Admin visibility (3 confirmation signals)

1. **Toast** on approval screen: amber *"Approved — card declined. Payment update email sent to {email}"*
2. **Application detail timeline** entry: *"Card-decline email sent · {timestamp}"* (logged into existing `application_status_history` or `email_audit_log`)
3. **`email_audit_log`** row for delivery tracking (sent/bounced)

### Manual fallback

Add a small **"Resend card-decline email"** button on the application detail panel, visible only when:
- The application is `approved`, AND
- An `application_card_declined` email has previously been sent to this applicant

### Files to change

- `supabase/functions/send-email/index.ts` — add `application_card_declined` template + HTML
- `src/pages/admin/Applications.tsx` — auto-fire on decline in approval charge path; add resend button in detail panel; amber toast
- `src/pages/admin/PaymentFailedEmailPreview.tsx` (or a new sibling preview page) — add preview route for the new template so you can review it before it goes live

### Review step

Before wiring the trigger live, I'll show you the rendered template at an admin preview route (same pattern as the existing Payment Failed preview) so you can sign off on the visual.
