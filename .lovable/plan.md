## Goal
Let admins edit a confirmed spa appointment in place — change the time/date, service, therapist, or room — without cancelling and rebooking. Notes already editable via the completion dialog.

## Where it appears
On `/admin/appointments`, each appointment card and slot will get an **Edit** (pencil) button beside the existing click-to-complete area. Clicking it opens a new `SpaAppointmentEditModal`, pre-populated with the appointment's current values.

## What can be edited
- Service (auto-updates duration, cleanup, price, category, name snapshots)
- Date
- Time (free-form input parsed like booking modal)
- Therapist (or "auto" via availability)
- Room (or "auto" via availability)
- Staff notes

Status, customer, and payment are NOT changed here (use existing flows).

## How it works
1. New component `src/components/admin/spa/SpaAppointmentEditModal.tsx`, modeled on `AdminSpaBookingModal`'s scheduling section (service/date/time/therapist/room/notes), minus customer search and payment.
2. Pre-populates from the passed `AdminSpaAppointment`.
3. Reuses `useCheckSpaAvailability` to validate the new slot, **excluding the current appointment id** so it doesn't conflict with itself. The existing RPC already supports this, but we'll verify and pass `excludeAppointmentId` if available; if not, we filter out self in the client-side conflict result.
4. New mutation hook `useUpdateSpaAppointment` in `src/hooks/useAdminSpaAppointments.ts` that updates: `service_id`, `service_name`, `service_category`, `service_price`, `member_price`, `appointment_date`, `appointment_time`, `duration_minutes`, `cleanup_minutes`, `staff_id`, `room_id`, `staff_notes`, `updated_at`. Invalidates `admin-spa-appointments`, `spa-appointments`, `spa-booked-slots`.
5. On success, toast "Appointment updated" and close.

## Guardrails
- Disabled for `cancelled` / `completed` / `no_show` appointments — show button only when status is `confirmed` or `checked_in`.
- Reuses the same conflict messaging from booking modal (instructor/room overlap, outside availability window).
- If the appointment was paid (`payment_intent_id` present) and the new service has a different price, show an info banner: "Pricing changed — collect/refund difference at checkout." No automatic Stripe action.

## RPC self-exclusion check
Quick check of `check_spa_availability` RPC signature; if it accepts `p_exclude_appointment_id`, pass it. Otherwise filter the returned `conflictingAppointments` array to drop the current `appointment.id` before deciding `available`.

## Files
- **New**: `src/components/admin/spa/SpaAppointmentEditModal.tsx`
- **Edit**: `src/hooks/useAdminSpaAppointments.ts` — add `useUpdateSpaAppointment`
- **Edit**: `src/pages/admin/Appointments.tsx` — add Edit pencil button + modal mount; same wiring also reaches Spa kiosk mode since it reuses this page

## Out of scope
- Changing the customer
- Refund/charge automation for price changes
- Bulk reschedule
