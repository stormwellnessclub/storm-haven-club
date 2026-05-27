## What's happening

The Admin Spa Booking modal lets you book an appointment **without selecting any customer at all**. When that happens, the insert falls into the `isWalkIn = !userIdToInsert` branch, the row is saved as `created_via='walk_in_guest'`, and no `Guest: …` header is written to `staff_notes` — so the appointment card has no name to display.

Checking the two most recent walk-in rows in the DB confirms this — `staff_notes` only contains free-text the admin typed (e.g. "718-427-0158 tried to buy mothers day voucher didnt work"), with no `Guest:` / `Phone:` header. The admin filled the staff-notes textarea but never actually clicked **"Use this guest"** in the walk-in subform, so `selectedCustomer` was `null` at submit time.

The downstream display logic in `useAdminSpaAppointments.ts` already parses the `Guest: Name <email>` / `Phone: …` header correctly — it just never gets written because the booking flow doesn't enforce that a customer was picked.

## Plan

Edit only `src/components/admin/spa/AdminSpaBookingModal.tsx`:

1. **Require a customer before booking.**
   - In `bookMutation.mutationFn`, throw early if `!selectedCustomer` ("Select a customer or add a walk-in guest before booking.").
   - Disable the **Book Appointment** button while `selectedCustomer` is null and show a small inline hint under the customer search.

2. **Make the walk-in subform self-confirming.**
   - When the admin clicks **"Use this guest"**, the customer is selected (this already works) — add a visible confirmation chip above the service section: `Booking for: {name} · {phone}` with a small "Change" link that clears `selectedCustomer`.
   - If the walk-in subform is open with a name typed but the admin tries to click **Book** without clicking "Use this guest" first, auto-apply the walk-in guest from the current `walkInName/Email/Phone` fields (fall-through safety so a half-filled form still produces a named booking).

3. **Slightly clearer empty-customer state.**
   - In `useAdminSpaAppointments.ts` keep current behavior for legacy rows: when no header found, render as `Walk-in guest` (already done). No data migration needed — the issue is preventing new nameless rows.

No backend, RLS, or schema changes. No edits to the display hook beyond the existing fallback.

## Files touched

- `src/components/admin/spa/AdminSpaBookingModal.tsx` — add submit guard, disable button, confirmation chip, auto-apply walk-in on submit.

That's it — once a customer (member, non-member, or walk-in) must be selected, the `Guest:` / `Phone:` header always gets written and the appointment card will show the name everywhere it's rendered.
