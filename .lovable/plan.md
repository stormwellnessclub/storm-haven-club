# Body Wrap intake form (online, like the massage form)

## Sample review
- No other company's name appears, but the sample was written for one solo practitioner ("**you** do not diagnose"). The form and its emails will use the spa's name, **Spa Aella**, and "our team". (The club itself is always "Storm Wellness Club", never just "Storm".)
- Removed: "How did you hear about me?"
- Removed: everything about undergarments.
- Removed: the lines saying the client read the "FAQ" and "Body Wrap Process". A link to the What to Expect blog can go in once it's written.
- Name, email, phone, address and date of birth fill in from the person's account. They can only edit address and date of birth.

## Things the sample is missing (will add)
- Emergency contact (name + phone)
- Claustrophobia / anxiety in tight wraps, kidney or liver conditions, thyroid conditions, low blood pressure / fainting, current medications, recent sun exposure, waxing or open cuts, and any recent pregnancy or breastfeeding
- Whether they have eaten and are hydrated, and a note to arrive 10 minutes early
- Photo/measurement consent, only if you take before/after inch measurements (optional checkbox)
- No-show policy (the sample had nothing on this). The client initials: "A no-call / no-show will be charged the full price of the service."
- Typed name as signature plus date (same as massage). The parent/guardian signature shows only when the person is under 18. The practitioner signs off in the admin view.

## How it works
1. When a Body Wrap is booked (by the client or by staff), the confirmation email has a "Complete Body Wrap Intake" button. The 2-hour and next-day reminders include it too while the form isn't done.
2. In the person's account (members and non-members), upcoming Body Wrap bookings show "Intake form needed". Tapping it opens the Body Wrap form, not the massage form.
3. A new **Forms** section in the person's profile lists every intake they've submitted (massage and body wrap) with date and service. They can view each one, and edit it until the appointment.
4. Staff see the completed form, a "missing intake" warning, and a practitioner sign-off in the spa appointment drawer.

## Technical details
- New table `spa_body_wrap_intakes` (one per appointment): health Y/N answers as jsonb, emergency contact, goals, initials checkboxes, signatures, guardian fields, practitioner_signed_by/at. RLS lets owners manage their own rows and spa staff read and sign. Grants are included.
- `serviceNeedsIntake` returns a type, `massage` or `body_wrap` (category "Body Wraps"). Wire that type through `IntakeFormDialog`, the SpaAppointmentRow intake check, and the `send-email` confirmation/reminder (`intakeKind` field changes the label and link).
- New `BodyWrapIntakeForm` component and hook alongside `useSpaIntake`. Add a Forms tab/section to member and non-member profile pages that queries both intake tables.
- No test emails are sent to real clients.
