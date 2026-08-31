# Malak Bazzi Dispute — Raw System Records Export

You asked for the actual records she agreed to, not a document I authored. Here is what the systems actually hold, and what I will export as unaltered evidence.

## What exists (verified, read-only)

- **Application record** (`membership_applications`, id `3d37a435-…`, created Mar 14 2026): stores her submitted details plus the acceptance checkboxes recorded at submission — `one_year_commitment`, `credit_card_auth`, `payment_info_provided`, `auth_acknowledgment`, `submission_confirmation`, `membership_agreement_signed`, card brand/last4, Stripe customer id, approval timestamp.
- **Email audit log**: system-sent emails to her address with timestamps, including `application_submitted` (Mar 14 2026), `approval_letter_personalized` and `member_activation_setup` (Mar 16 2026), and `charge_confirmation` emails — with stored subject and template data.
- **Stripe records**: customer, saved payment method, subscription creation, and every paid invoice/charge from March through August 2026 with no prior dispute or cancellation request.
- **Usage records**: `check_ins` (including Aug 16 2026 9:28 AM ET, the day of the disputed charge) and `class_bookings` / booking confirmation emails.

## What does NOT exist (important — I will not imply otherwise)

- No handwritten or drawn signature image, and no stored signed PDF of her agreement.
- No captured IP address or browser/user-agent for her submission (that tracking table has no row for her — it predates it).
- `liability_waiver_signed` is false.

The binding record is the **electronic acceptance data** in the application row plus the timestamped email trail — that is what is defensible, and it is what I will export verbatim.

## What I will produce

1. **Raw data exports** (unedited, machine-generated, one row per record):
   - `malak-bazzi-application-record.csv` / `.json` — every column of her application row, verbatim.
   - `malak-bazzi-email-log.csv` — all system emails with timestamps and subjects.
   - `malak-bazzi-checkins.csv` — full check-in history with timestamps (America/Detroit).
   - `malak-bazzi-stripe-records.json` — raw Stripe customer, subscription, payment method, and full invoice/charge list pulled directly from the Stripe API.
2. **Records appendix PDF** (`malak-bazzi-records-appendix.pdf`) that presents those same exports as readable tables, each labeled with its source table/API, the query used, and the export timestamp — so every line traces back to a system record rather than narrative text.
3. A short cover page stating exactly what the records are, what they are not (no wet signature, no IP capture), and that nothing was edited.

Then you can submit the v3 rebuttal PDF plus this appendix and the raw files as Stripe evidence.

## Technical notes

- Read-only: `SELECT` queries and Stripe read calls only. No migrations, no data changes, nothing submitted to Stripe.
- Timestamps rendered in `America/Detroit` with UTC shown alongside.
- Every page of the generated PDF will be image-QA'd before delivery.

## Optional (say the word)

If you want an unforgeable signature record going forward, I can add signature capture + IP/user-agent logging to the application and waiver flow — separate work, not part of this export.
