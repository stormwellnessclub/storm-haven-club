

## Apply Page Overhaul — Plan

This is a large set of coordinated changes across the application form, progress stepper, validation, confirmation email, and abandoned application recovery.

### Files to Modify

**1. `src/pages/Apply.tsx`** — Main form page
- **Hero copy**: Replace heading with "Membership is by application." and new subheading/supporting text per spec.
- **Remove payment step entirely**: Delete the `PaymentSectionEnhanced` usage (lines 1495-1530), the `<div ref payment>` section, all Stripe-related state (`showPaymentForm`, `paymentClientSecret`, `isSavingCard`, `stripeCustomerId`, `isCardConfirmed`, `savedCardDetails`), the `handleSavePaymentMethod` function, the 3DS return handler, and all payment-related imports.
- **Remove payment-related form fields**: Delete `creditCardAuth`, `paymentAcknowledged` from `initialFormData` and all references.
- **Remove payment-related validation** from `handleSubmit` (lines 745, 758-762, 843-852).
- **Add intro text** to Step 1 (Personal Info), Step 2 (Membership Selection — note: membership plan select is currently inside the Personal Info section, so it may need restructuring or the intro can be added above the select), and Step 3 (Wellness Profile sections).
- **Rewrite Agreements section** (lines 1531-1618): Remove the STOP warning card, remove `authAcknowledgment` and `submissionConfirmation` checkboxes, keep only `membershipAgreementSigned` and `oneYearCommitment`. Add new intro text per spec.
- **Update founding member description** (lines 1418-1423) with new copy.
- **Update submit button text** to "Submit My Application".
- **Update post-submit confirmation** (lines 907-947) with new message.
- **Update confirmation email** call (lines 878-894) to pass updated data for new email template.
- **Add abandoned application tracking**: After Step 1 email is entered, save email + first name + timestamp to localStorage. On component mount, set a 2-hour timer. If form not submitted after 2 hours and email was captured, call a backend function to send the abandonment email (only once, tracked via a flag).

**2. `src/components/ApplicationProgress.tsx`**
- Remove `payment` step from `APPLICATION_STEPS` array.
- Renumber steps: personal, membership, goals, background, motivation, lifestyle, agreements (7 steps instead of 8).
- Update `getStepCompletion` to remove payment case and simplify agreements case (only `membershipAgreementSigned` + `oneYearCommitment`).

**3. `src/components/ApplicationValidationSummary.tsx`**
- Remove the payment-specific warning block (lines 70-93).
- Change submit button text from "Submit Application" to "Submit My Application".

**4. `supabase/functions/send-email/index.ts`**
- Update the `application_submitted` case with new subject line ("We received your application — Storm Wellness Club"), new body copy per spec, links to /amenities, /spa, /classes, and signed by founder name.
- Change sender from `admin@stormwellnessclub.com` to a named sender (e.g., `Founder Name <membership@stormwellnessclub.com>`).

**5. `supabase/functions/send-abandoned-application/index.ts`** (new)
- New edge function triggered from the client after 2-hour timeout.
- Accepts `email`, `firstName`.
- Checks if the email already has a submitted application (status != `pending_payment`). If so, skip.
- Checks a `card_setup_attempts` or similar table to ensure reminder was not already sent for this email.
- Sends the abandonment email with specified copy via Resend.
- Logs to `email_audit_log`.

**6. `supabase/config.toml`**
- Add entry for `send-abandoned-application` function.

**7. Files to remove/clean up**
- `src/components/PaymentSectionEnhanced.tsx` — Can remain in codebase but will no longer be imported from Apply.tsx. The `ApplicationUnderReview` component still uses its own payment flow, so we keep it.

### Step Organization Note

The current form has steps mapped to section refs, but the actual form sections don't always align 1:1 with the stepper. The membership plan select is currently inside the "Personal Information" card. To match the user's request for distinct Step 1 (Personal Info) and Step 2 (Membership Selection) intros, I'll split the membership plan select into its own card section with its own ref.

### Abandoned Application Flow

Rather than a complex cron-based system, the client-side approach:
1. When the user fills in their email in Step 1, save `{email, firstName, timestamp}` to localStorage under a key like `storm_apply_abandon_track`.
2. On page load, check if there's an existing abandon track entry older than 2 hours that hasn't been sent yet.
3. If so, call the `send-abandoned-application` edge function once, then mark it as sent in localStorage.
4. This is simple and doesn't require database polling or cron jobs. The edge function validates server-side that no duplicate reminder is sent.

