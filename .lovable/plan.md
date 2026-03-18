

## Plan: Add "Skip Tour / Activate Upon Approval" Option to Application

### What Changes

In the **Agreements** section (Step 7) of `Apply.tsx`, add a new checkbox option below the one-year commitment:

**New checkbox and verbiage:**

> **☐ I do not need a tour scheduled and would like my membership activated upon approval.**
>
> By selecting this option, you are confirming that you are ready to begin your membership immediately upon approval without a private walkthrough. This means:
>
> - Your **initiation fee** will be charged upon activation (non-refundable).
> - Your **monthly dues** will begin immediately based on your selected membership tier.
> - You acknowledge the **minimum one-year commitment** and understand that early cancellation is subject to the terms outlined in the Membership Agreement.
> - You agree to the **Membership Agreement** and **Liability Waiver** terms as provided.
>
> *If you prefer a tour first, simply leave this unchecked — we'll reach out to schedule one after approval.*

When this checkbox is checked, the existing **Membership Agreement** and **One-Year Commitment** sections (which are already in the form) remain visible and required — they serve as the binding agreements. Additionally, a **Liability Waiver** acknowledgment checkbox will appear (reusing the existing waiver agreement pattern).

### Technical Changes

1. **`src/pages/Apply.tsx`**:
   - Add `skipTourActivateImmediately: false` and `liabilityWaiverSigned: false` to `initialFormData`
   - Add the new checkbox + explanatory card in the Agreements section, after the one-year commitment
   - When checked, show the liability waiver section (similar to `MembershipAgreementSection` but for liability waiver)
   - Include `skip_tour_activate_immediately` and `liability_waiver_signed` in the submission payload
   - Update validation: if `skipTourActivateImmediately` is true, require `liabilityWaiverSigned` to also be true

2. **`src/components/ApplicationProgress.tsx`** (if needed): Update step completion logic to account for the new fields

3. **Database migration**: Add `skip_tour_activate_immediately boolean default false` and `liability_waiver_signed boolean default false` columns to `membership_applications` table

4. **Admin visibility**: The admin application review page will show whether the applicant opted to skip the tour, so admins know they can activate immediately upon approval

