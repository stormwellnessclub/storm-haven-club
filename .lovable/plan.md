## What's broken

**1. "Name unavailable" on non-member / walk-in spa appointments**

In `AdminSpaBookingModal`, the customer picker only lets the admin select an existing record (member, non-member profile, or a saved guest-pass row with a Stripe customer). There is no way to type in a brand-new walk-in's name + contact. When the admin skips selection and just types details into the notes field, the appointment is saved with `user_id = NULL` **and** no `Guest: …` header in `staff_notes`, so the display fallback in `useAdminSpaAppointments` finds nothing → renders "Name unavailable".

For real non-member portal bookings (which do have `user_id`), the resolver already reads `non_member_profiles` then falls back to `profiles`, so those should show. The "Name unavailable" you're seeing is the walk-in path.

**2. Editing the notes won't save**

`SpaAppointmentEditModal.handleSave` runs the full `update_spa_appointment_admin` RPC, which:
- Bails early if `selectedService || appointmentTime || appointmentDate` is missing.
- Blocks with "Please assign a therapist or room" when both come back null (very common on legacy walk-in rows with no `staff_id`/`room_id`).
- Runs full conflict / availability checks even when the only thing changed is the notes textarea.

So a notes-only edit silently does nothing or trips a blocker that has nothing to do with the notes.

---

## Plan

### A. Let admins capture walk-in customer info at booking time

In `src/components/admin/spa/AdminSpaBookingModal.tsx`:

- Add an **"Add walk-in guest"** button under the customer search (shown when nothing is selected).
- Clicking it opens an inline mini-form with **Name (required)**, **Email**, **Phone**.
- On confirm, set `selectedCustomer` to a synthetic guest object (`type: "guest"`, no `userId`, name/email captured).
- On insert, write the header into `staff_notes` as:
  ```
  Guest: <Name> <<email>>
  Phone: <phone>
  ```
  (the existing code already prepends a `Guest:` line for guest-type customers — extend it to include phone on a second line).

### B. Make the display fallback more forgiving

In `src/hooks/useAdminSpaAppointments.ts`, when `user_id` is null and `member` is null:

- Keep the existing `Guest: Name <email>` regex.
- Also parse a `Phone: <…>` line and surface it on the customer object.
- If neither header is present, return a placeholder customer `{ type: "guest", first_name: "Walk-in", last_name: "guest", email: null }` instead of `null`, so the row reads "Walk-in guest" (with a visible badge) instead of "Name unavailable".

Update `SpaCustomer` to optionally carry `phone?: string | null` and surface it in the availability list / edit modal header.

### C. Add a notes-only save path

In `src/components/admin/spa/SpaAppointmentEditModal.tsx`:

- Add a secondary **"Save notes only"** button next to the main Save button.
- That button writes via `useUpdateSpaAppointmentStatus` (already supports `staffNotes`) reusing the appointment's current status — bypassing the service/time/conflict guards.
- Also relax the existing main-Save guard so changes that don't touch service/date/time/therapist/room don't get blocked by "Please assign a therapist or room" — if nothing schedule-related changed vs. the loaded appointment, skip the conflict check and just patch the notes.

### D. Backfill display for the rows already in the database

No data migration needed — once B is in, every existing walk-in row (including the ones that just say "718-427-0158 tried to buy mothers day voucher…") will render as "Walk-in guest" with the notes shown inline, instead of "Name unavailable".

---

## Files touched

- `src/components/admin/spa/AdminSpaBookingModal.tsx` — walk-in guest mini-form, phone in header.
- `src/hooks/useAdminSpaAppointments.ts` — friendlier customer fallback + phone parse + `phone` field on `SpaCustomer`.
- `src/components/admin/spa/SpaAppointmentEditModal.tsx` — "Save notes only" button + relaxed guard when only notes changed.
- `src/components/admin/spa/SpaAvailabilityTab.tsx` — small render tweak so walk-in customers show name + phone if present.

No DB migration, no RLS changes, no edge function changes.