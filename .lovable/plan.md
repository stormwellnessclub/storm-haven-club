## Goal

Stop hiding the intake form below the booking-confirmation card. Make it an explicit, unmissable step in the massage booking flow — collected BEFORE we charge the card and create the appointment, then saved against the new appointment immediately afterwards.

## What changes (user-visible)

In `SpaBookingModal`, for any service flagged `requires_intake_form` (all massages today), the booking flow becomes a two-step wizard inside the same dialog:

```text
Step 1: Booking details                Step 2: Intake form
┌────────────────────────────┐         ┌────────────────────────────┐
│ Service / date / time /    │         │ Focus areas (body diagram) │
│ voucher / payment method   │   →     │ Pressure, pain, health,    │
│                            │         │ allergies, goals, consent  │
│ [ Continue to Intake → ]   │         │ [ ← Back ]  [ Confirm &    │
│                            │         │              Book $XX.XX ] │
└────────────────────────────┘         └────────────────────────────┘
                                                    ↓
                                       Booking Confirmed screen
                                       (no intake block — already done)
```

- Non-intake services (red light, dry cryo, salt room, etc.) keep today's single-step flow unchanged.
- The "Booking Confirmed" screen stays, but the amber "Complete your intake form" block is removed for the standard path. We keep it only as a fallback for legacy appointments that somehow reach confirmation without an intake on file.

## Why this is better

- The user physically cannot finish booking a massage without seeing the form — no scroll, no dismiss, no second dialog to load.
- Therapist always has the form by the time the appointment exists in the DB.
- Removes reliance on the post-booking dialog/secondary mount that has been the source of the "form doesn't show" reports.

## Technical notes

1. `SpaBookingModal.tsx`
   - Add `step: "details" | "intake"` local state. Default `"details"`.
   - Compute `needsIntake` as today (DB flag + massage/body name/category fallback).
   - Replace the bottom "Book for $X" button with:
     - If `needsIntake && step === "details"`: button label "Continue to Intake →", on click validates date/time/waiver/payment selection then `setStep("intake")` (no charge yet).
     - If `!needsIntake`: keep existing single Book button.
   - When `step === "intake"`:
     - Render `<SpaIntakeForm showHeader={false} submitLabel="Confirm & Book $X.XX" onSubmit={...} />` in place of the details body.
     - Add a "← Back to details" link at the top.
     - `onSubmit` of the intake form is the new commit handler: it runs the existing `handleBook` logic (voucher / credit / card charge → `bookAppointment.mutateAsync`), then immediately calls `useSubmitIntakeForm().mutateAsync({ ...intakeValues, appointment_id: appt.id, member_id })`, then sets `confirmation`.
     - If the intake save fails after booking succeeds, surface a toast and keep the confirmation screen's fallback amber block visible so they can retry — appointment is not lost.
2. Remove the `InlineIntakeForm` block (lines 557–577) from the confirmation screen for the happy path; keep the component definition and render it only as a fallback when `confirmation.needsIntake === true` (set only on the failure path above).
3. Leave `Spa.tsx`'s page-level `IntakeFormDialog` mounted as-is for safety, but it should rarely trigger now.
4. No DB, RPC, hook, or edge-function changes. `useSubmitIntakeForm` and `useIntakeForm` already exist and stay unchanged.

## Out of scope

- No changes to non-massage services.
- No changes to admin spa flows.
- No changes to the intake form fields themselves.
