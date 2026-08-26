# Intake Form: Readable Staff View + Pregnancy Details

## 1. Staff view shows answers without the questions

On the therapist/admin side the intake summary uses tiny abbreviated labels in a
narrow fixed column — "Avoid", "Health conditions", "Pressure" — and it hides any
question the client left blank. So you see a sentence with no idea what was asked.

Changes to the staff intake summary:
- Use the full question text as the label, matching what the client saw:
  - "Focus areas requested"
  - "Preferred pressure"
  - "Current pain / tension level" (plus the 0-10 number and the "where does it
    hurt / injuries" answer underneath)
  - "Health conditions reported"
  - "Allergies (oils, lotions, fragrances)"
  - "Current medications"
  - "Goals for this session"
  - "Areas to avoid"
  - "Prior massage experience"
- Show every question, always — blank answers read "None reported" in muted text
  instead of disappearing. No more guessing which question a reply belongs to.
- Stack the question above the answer so long labels don't get squeezed or cut off,
  with a light divider between entries for scanning.
- Keep the body diagram, the health-condition red badges, and the signed stamp.

## 2. Pregnancy follow-up questions

When a client checks "Pregnancy" in health conditions, three extra questions appear
right below it (and only then):
- "How many weeks along are you?" — number, 1-45
- "Any accommodations you need?" — free text (side-lying, bolster/pillow support,
  no prone position, etc.)
- "Any restrictions from your doctor?" — free text

These show on the staff summary in their own highlighted "Pregnancy details" block
so the therapist can't miss them, with the week count called out.

Nothing else about the form changes — same required fields (at least one focus
area plus consent), same everything else.

## 3. Email wording (carried over from the previous plan)

The confirmation email keeps the "Complete Intake Form" button and adds a fallback
line: if the button doesn't work, sign in to your account dashboard, open
"My Bookings", and the appointment has a "Complete Intake Form" button on it.

## Technical detail

- Migration: add `pregnancy_weeks` (integer, nullable), `pregnancy_accommodations`
  (text, nullable), `pregnancy_restrictions` (text, nullable) to
  `public.spa_intake_forms`. Existing RLS policies and grants cover them; no new
  policies needed.
- `src/hooks/useSpaIntake.ts` — extend `SpaIntakeForm` / `SpaIntakeFormInput` and the
  upsert payload with the three fields; clear them when pregnancy is unchecked.
- `src/components/spa/SpaIntakeForm.tsx` — conditional pregnancy block driven by
  `healthConditions.includes("pregnancy")`.
- `src/components/spa/IntakeFormSummary.tsx` — rewrite the `Field` layout to stacked
  label/value with dividers, always-render fields with an empty fallback, full
  question labels, and a pregnancy details block.
- Email copy change in `supabase/functions/send-email/index.ts`
  (`spa_appointment_confirmation`), then redeploy that function.

After this lands I'll send the four Sept 13 confirmation emails.
