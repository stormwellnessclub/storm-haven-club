## B3 — Certificate of Electronic Signature (on-demand PDF)

Goal: One click on any admin "Member detail" view → produces a Stripe-ready PDF that proves a specific person electronically signed a specific agreement at a specific time. Attach it to any dispute in seconds.

### What the certificate contains

A single multi-page PDF generated server-side:

**Page 1 — Certificate of Electronic Signature**
- Storm Wellness Club header + logo
- Signer block: full name, email, phone, user_id (UUID)
- Agreement block: title, type, version, PDF filename, SHA-256 hash of the exact PDF that was on screen
- Signature block:
  - "Signed electronically on: 2026-04-11 00:26:11 UTC (2026-04-10 19:26:11 America/Chicago)"
  - Acknowledgment statement (the literal label next to the checkbox: *"I have reviewed this document above"*)
  - Action confirmation (*"I Agree — Sign {Title}"* button click)
  - IP address (if captured)
  - User agent (if captured)
- ESIGN/UETA legal basis paragraph
- QR code → links to a public verification URL `/verify-signature/{signature_id}` that re-displays the record (read-only)

**Page 2+ — The actual agreement PDF that was signed** (embedded, page-for-page)

**Last page — Audit trail table** pulled from `agreement_signatures` (or, for backfilled rows, from `profiles.*_signed_at`): timestamp, event, source.

### How it gets generated

1. New admin button **"Generate Signature Certificate"** appears on:
   - `src/pages/admin/People.tsx` member detail panel (per-member, dropdown of signed agreements)
   - Stripe dispute detail view (auto-selects the agreement most relevant to the disputed charge type — class pass charge → Single Class Pass Agreement)

2. Click → calls a new edge function `generate-signature-certificate` with `{ user_id, agreement_type }`.

3. Edge function:
   - Auth: verify caller has `admin` role
   - Fetches signer info from `profiles`
   - Fetches the signed-at timestamp from `profiles.{type}_signed_at`
   - Fetches the agreement row + its `pdf_url` from `agreements` table
   - Downloads the PDF, computes SHA-256
   - Builds the certificate PDF with `pdf-lib` (Deno-compatible; better than jspdf server-side), merges the agreement PDF as subsequent pages
   - Returns the PDF as a binary download (`application/pdf`)

4. Frontend triggers a browser download named `Signature-Certificate-{LastName}-{AgreementShortName}.pdf`.

### Optional but recommended companion: the audit log table

Without an audit log we can only prove "the boolean is TRUE and a timestamp exists" — there's no IP, no user-agent, no document hash. This is fine for Stripe but weak in court.

I recommend a **lightweight** `agreement_signatures` table that captures, per click going forward: `user_id`, `agreement_type`, `agreement_version`, `pdf_sha256`, `signed_at`, `ip_address`, `user_agent`. The certificate uses it if a row exists; otherwise falls back to the legacy `profiles` columns and marks the certificate "Audit source: legacy profile record."

I'll **defer building that table** unless you tell me to include it — for now the certificate works against existing data so you can use it on the Nejme dispute today.

### Technical details (skim or skip)

- Library: `pdf-lib` (works in Deno edge functions; supports embedding existing PDFs which jspdf does not). Add to function via `npm:pdf-lib@^1.17.1`.
- QR code: `npm:qrcode@^1.5.4` rendered to PNG buffer, embedded via `pdf-lib`.
- SHA-256: native `crypto.subtle.digest`.
- Storage: certificate is generated on-demand and streamed back — not persisted. (We can optionally upload to a private `signature-certificates` bucket later if you want a permanent archive.)
- Verification URL: a public route `/verify-signature/{user_id}/{agreement_type}` that renders a minimal page reading from the same data — no PII beyond name + agreement + timestamp.

### Files to add / edit

- `supabase/functions/generate-signature-certificate/index.ts` — new edge function
- `src/components/admin/SignatureCertificateButton.tsx` — new reusable button + downloader
- `src/pages/admin/People.tsx` — surface the button in the member detail drawer under "Agreements"
- `src/pages/VerifySignature.tsx` + route registration in `App.tsx` — public verification page
- (no DB migration in this phase)

### What I need from you to proceed

You said you'd attach what Stripe gave you for the dispute — drop those in and I'll:
1. Build B3 as scoped above
2. Run it against Nejme's record and hand you the certificate PDF for direct upload to Stripe.

If you also want the `agreement_signatures` audit table built in this same loop, say "include the audit table" and I'll add the migration + wire the click handlers.
