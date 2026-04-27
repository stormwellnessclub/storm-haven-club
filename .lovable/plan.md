# Membership Application Refinement (Revised)

Refining the existing `src/pages/Apply.tsx` — not rebuilding. Per your update: **both the Membership Agreement and the Liability Waiver are signed at application time**, so they're already on file when approval happens.

## 1. Remove the tour-vs-activate-now choice

In `src/pages/Apply.tsx`:

- Delete the entire "Skip Tour / Activate Immediately" block (the checkbox, the conditional Card with bullet list, and the "If you prefer a tour first…" italic line).
- Remove `skipTourActivateImmediately` from `initialFormData` and stop sending `skip_tour_activate_immediately` in the payload (DB column stays, just unused).
- Remove all `skipTourActivateImmediately` conditionals from the Payment Method section copy.
- Update `getStepCompletion` in `src/components/ApplicationProgress.tsx` to drop `skipTourActivateImmediately` from the type and simplify the `payment` and `agreements` cases.

## 2. Replace yes/no "Referred by member?" radio with optional text field

Currently a required yes/no radio. Replace with:

- **Label:** "Member Referral"
- **Helper text:** "Do you know a current Storm Wellness Club member? If so, include their name. A referral is not required, but it is considered as part of your application review."
- **Input:** single optional text field, max 100 chars, placeholder "Member's full name (optional)"
- Reuse the existing `referredByMember` form key and `referred_by_member` DB column. Empty string submits as `null`.
- Remove `!formData.referredByMember` from submit validation and from the `motivation` step in `getStepCompletion`.

Placement stays the same (after Holistic Wellness textarea, before the Founding Member block).

## 3. Application notice above the submit button

Add as understated body text (muted-foreground, no alert box, no icon) directly above `<ApplicationValidationSummary />` in `Apply.tsx`:

> "Storm Wellness Club reviews each application personally. In some cases, our team may reach out before a final decision is made. This is part of our process — and a sign of genuine interest."

## 4. Rebuild the Agreements section — 5 required checkboxes + both documents signed

Replace current Agreements card content with a clean, well-spaced list. Generous `space-y-6` between items, no nested boxes around each row, labels use `text-sm leading-relaxed text-foreground` so they're actually read.

### New form state (all `boolean`, default `false`):
- `ackOneYearCommitment` → maps to existing DB column `one_year_commitment`
- `ackInitiationFee` → new DB column `ack_initiation_fee`
- `ackMembershipAgreement` → maps to existing `membership_agreement_signed` AND triggers signing in `member_agreements` table at submit
- `ackLiabilityWaiver` → maps to existing `liability_waiver_signed` AND triggers signing in `member_agreements` table at submit (new — was previously only collected if "skip tour" was checked; now collected from everyone)
- `ackCardOnFile` → new DB column `ack_card_on_file`
- `ackFinalReadiness` → new DB column `ack_final_readiness`

### Migration:
```sql
ALTER TABLE public.membership_applications
  ADD COLUMN IF NOT EXISTS ack_initiation_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ack_card_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ack_final_readiness boolean NOT NULL DEFAULT false;
```

### Checkbox copy (each on its own line, generous spacing):

**1. One-year commitment**
"I understand that Storm Wellness Club membership requires a one-year commitment. By submitting this application, I acknowledge that I am ready to commit to a full year of membership upon approval."

**2. Initiation fee**
"I understand that a $300 initiation fee is due upon approval of my application. This fee is non-refundable under any circumstances."

**3. Membership Agreement** — paired with the existing `MembershipAgreementSection` which renders the PDF view/download buttons directly above the checkbox so the document is genuinely linked.
"I have read and agree to the Storm Wellness Club Membership Agreement in full."

**4. Liability Waiver** — paired with the existing `LiabilityWaiverSection` (PDF view/download buttons above the checkbox).
"I have read and agree to the Storm Wellness Club Liability Waiver in full."

**5. Card on file**
"I understand that a valid credit or debit card is required on file upon membership activation. My card will be kept securely on file for recurring monthly dues."

**6. Final readiness**
"I confirm that I have fully read this application, understand all terms and commitments, and am ready to move forward as a Storm Wellness Club member upon approval."

(Six checkboxes total — your brief listed five but the waiver makes six. Reads cleanly.)

### Submit-time persistence (so the signatures actually carry over to the member account):

When the application is submitted, in addition to the `INSERT` into `membership_applications`, write rows to `member_agreements` (the canonical signed-agreements table) for both:
- `agreement_type = 'membership_agreement'`
- `agreement_type = 'liability_waiver'`

Both keyed to the applicant's email. On approval, the existing application-approval flow already links the auth user to the member record by email — these signed agreements will resolve automatically. The applicant won't be re-prompted in `WaiverSigningStep` / `InlineWaiverGate` because `profile.waiver_signed` and `profile.membership_agreement_signed` will both be set during the approval/linking step.

I'll verify the exact column names on `member_agreements` and the approval-flow update before writing the insert — if the simplest path is just to set `liability_waiver_signed = true` on the application row (and let the approval flow flip the profile flags), I'll do that instead. Either way, end result: applicant signs once, both documents are on file.

### Submit gating:
All 6 checkboxes must be checked. Update `handleSubmit` validation and the `agreements` case in `getStepCompletion` accordingly.

## 5. Copy audit (sales/urgency → calm/selective)

Pass through `Apply.tsx` and rewrite anything that reads like marketing:

- Strip "transformative," "exclusive amenities," and similar adjectives from the page intro and Agreements card intro.
- Agreements card intro becomes: "Please review and acknowledge each of the following before submitting your application."
- Founding Member block: keep the structural info (annual prepay, perks, pricing table) but replace the amber "⚠️" alert with neutral border + plain heading, and trim adjective-heavy copy.
- Replace any "Join Storm" / "Become a member today" CTAs with neutral language.
- Submit button stays "Submit My Application."

## 6. Not changing

- Tier structure, pricing, founding member pricing.
- Brand colors, typography, layout, `card-luxury` styling.
- Working fields: personal info, address, plan selection, wellness goals, services, motivations, lifestyle/holistic textareas, founding member yes/no.
- Stripe `PaymentElement` integration — only surrounding "required vs optional" copy changes.
- Draft auto-save and duplicate-application check.
- The progress stepper UI itself.

## Files

- `src/pages/Apply.tsx` — primary edit
- `src/components/ApplicationProgress.tsx` — `getStepCompletion` signature + logic
- New migration: 3 new boolean columns on `membership_applications`
- Possible insert into `member_agreements` at submit time (depends on what I find when I view that table — will choose the simplest reliable path)

## Out of scope (flag if you want it)

- Admin Applications detail screen showing the new acknowledgment columns — not displayed until you ask.
- Email confirmation copy after submit — separate review.
