## Finding

Massage services are marked as requiring intake, but the intake dialog lives inside `SpaBookingModal`. The public `/spa` page immediately clears `selectedService` when the booking modal closes. That can unmount/reset the booking modal state right as the intake prompt is supposed to open, so the customer only sees the booking close instead of the intake form.

## Plan

1. **Move the intake prompt state up to the `/spa` page**
   - Add a booking-complete callback to `SpaBookingModal`.
   - When a massage appointment is created and intake is required, pass the appointment ID/member ID/service name back to the page before closing the booking modal.
   - Render `IntakeFormDialog` directly from `src/pages/Spa.tsx` so it remains mounted after `selectedService` is cleared.

2. **Keep existing behavior for other booking entry points**
   - Keep the internal intake fallback in `SpaBookingModal` so member wellness/recovery booking still works without requiring parent changes.
   - Only use the new parent callback where `/spa` mounts the modal.

3. **Make the trigger harder to miss**
   - Treat a service as intake-required if `requires_intake_form` is true OR the service category/name indicates massage/body treatment, so bad service configuration cannot silently skip the form.

4. **Validate the actual database flag**
   - Confirm active massage services are already `requires_intake_form = true`; no data update is needed for massage.
   - If we want body rituals/wraps to require intake too, we can update those separately, but the reported issue is massage.