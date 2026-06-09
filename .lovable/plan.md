# Spa Intake Form Fixes

Two real bugs cause the intake form to be invisible to both clients and staff. All massage services already have `requires_intake_form = true` in the database — the data is fine, the UI flow is broken.

## Problem 1 — Client never gets the intake prompt (from `/spa`)

`SpaBookingModal.tsx` has `if (!service) return null;` at line 242, and the `<IntakeFormDialog>` is rendered inside that same component (line 969). When booking succeeds, the modal calls `onOpenChange(false)`, and the parent `Spa.tsx` (line 542) then calls `setSelectedService(null)`. That unmounts the entire `SpaBookingModal` — taking the intake dialog with it — before the dialog ever opens. So the user sees the booking close and… nothing.

(`member/Wellness.tsx` doesn't null `selectedService`, so it works there — confirming the bug is the unmount on `/spa`, which is the path clients use for massages.)

**Fix:** Restructure `SpaBookingModal` so the `IntakeFormDialog` lives outside the `if (!service) return null;` guard. Render it always (it self-guards on `appointmentId == null`), keep `intakeOpen` / `intakeAppointmentId` / `intakeMemberId` state in a small wrapper component or hoist the early return so the intake dialog remains mounted after the booking dialog closes.

## Problem 2 — Staff can't view submitted intake forms

Admins/staff today can only see the intake form inside `SpaCompletionDialog` (i.e. when checking out an already-completed appointment). There's no way to view it from the Therapist Schedule or the appointment edit modal before/during the session, so therapists can't actually prepare.

**Fix:** Add intake form visibility in two places:

1. **`SpaAppointmentEditModal`** — add a "Client Intake Form" section using the existing `useIntakeForm` hook and `IntakeFormSummary` component. Show the summary if submitted, or a muted "Not yet submitted" note if not.
2. **Therapist Schedule day/week view (`SpaAvailabilityTab`)** — on each appointment card/popover, show a small badge ("Intake ✓" / "Intake pending") and a "View intake" button that opens a lightweight dialog wrapping `IntakeFormSummary`.

## Files touched

- `src/components/booking/SpaBookingModal.tsx` — hoist `IntakeFormDialog` above the `if (!service) return null;` guard so it survives unmount.
- `src/components/admin/spa/SpaAppointmentEditModal.tsx` — render intake summary section.
- `src/components/admin/spa/SpaAvailabilityTab.tsx` — add intake status badge + view button on appointment items.
- (No DB / RLS changes — `spa_intake_forms` policies already allow staff reads.)

## Out of scope

- No changes to the intake form itself, no new fields, no schema migrations.
- Sports Stretching services keep `requires_intake_form = false` (per your earlier instruction).
