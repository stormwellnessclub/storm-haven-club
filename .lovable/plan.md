
## Goal

Send Amal Berry (`amalberry.03@gmail.com`) a single billing-outreach email about her failed acai bowl payment, including a Stripe payment link for **$27.60** ($25.00 + $1.50 MI 6% tax + $1.10 processing fee). Reply-To is `admin@stormwellnessclub.com` so her response lands with staff.

## About the "From" address

The project's app-email infrastructure sends from the verified transactional subdomain (`notify.stormwellnessclub.com`) — that's what Mailgun is provisioned for. Overriding the From to `admin@stormwellnessclub.com` would require re-scaffolding sender DNS and is out of scope for a one-off send. Instead:

- **From:** `Storm Wellness Club <notify@stormwellnessclub.com>` (existing sender)
- **Reply-To:** `admin@stormwellnessclub.com`

Any reply from Amal will route directly to the admin inbox, which achieves the intent. If you want the visible From line to literally read `admin@stormwellnessclub.com`, that's a separate DNS/sender-domain change we can do afterward.

## Steps

1. **Create the Stripe payment link** for $27.60 USD:
   - Product: `Storm Cafe — Acai Bowl (Outstanding Balance)`
   - Price: one-time $27.60
   - Payment link generated via Stripe API, no login required, tied to Amal's email so it prefills.
   - Capture the resulting `payment_link.url` to embed in the email.

2. **Add a new transactional email template** at `supabase/functions/_shared/transactional-email-templates/billing-outreach-acai.tsx`:
   - Props: `firstName`, `amountDisplay` ("$27.60"), `itemizedLine` ("$25.00 acai bowl + $1.50 MI sales tax + $1.10 processing fee"), `paymentUrl`.
   - Subject: `Storm Cafe — Payment Issue on Your Recent Acai Bowl`.
   - Body matches the draft shown above. Uses existing Storm brand styling (white body, brand button).
   - Register in `_shared/transactional-email-templates/registry.ts`.

3. **Deploy** `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `process-email-queue` after template registration.

4. **Trigger the send** exactly once via `supabase.functions.invoke('send-transactional-email', ...)` with:
   - `templateName: 'billing-outreach-acai'`
   - `recipientEmail: 'amalberry.03@gmail.com'`
   - `idempotencyKey: 'billing-outreach-acai-amalberry-<timestamp>'`
   - `replyTo: 'admin@stormwellnessclub.com'`
   - `templateData: { firstName: 'Amal', amountDisplay: '$27.60', itemizedLine: '$25.00 acai bowl + $1.50 MI sales tax + $1.10 processing fee', paymentUrl: <stripe link> }`

5. **Log the outreach** by inserting a row into `billing_outreach_logs` (channel = `email`, note = `Manual acai bowl balance outreach — $27.60 payment link sent`). Since no `billing_arrears` row exists for this cafe transaction, `arrears_id` will be NULL — the log entry just records the attempt against her member row if she has one, otherwise against her profile email in the note.

## Verification

- Payment link opens Stripe-hosted checkout showing $27.60.
- `email_send_log` shows one row per `message_id` transitioning `pending → sent` for template `billing-outreach-acai` to `amalberry.03@gmail.com`.
- Reply-To header in the received email is `admin@stormwellnessclub.com`.
- `billing_outreach_logs` has the new row.

## Out of scope

- Reconfiguring sender DNS so From is literally `admin@stormwellnessclub.com`.
- Creating/backfilling a `billing_arrears` row for the cafe charge.
- Any dunning automation or repeat scheduling — this is a single manual send.
