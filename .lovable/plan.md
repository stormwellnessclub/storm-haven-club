
## Goal
Every spa appointment should display the customer's real name (member, non-member, or walk-in guest) — never a bare "Guest" — and we should always know **who created the booking**: the customer themselves, or which admin booked it on their behalf.

## What's wrong today
1. **Display fallback to "Guest"**: When name resolution fails (RLS hides `non_member_profiles`, or a walk-in row has no `staff_notes` header), the admin appointment cards collapse to the literal word "Guest" — which is what you saw on Rola's row even though she's a real account holder in `non_member_profiles`.
2. **No booking attribution**: `spa_appointments` does not store who performed the insert. Both the member self-booking flow (`useSpaBooking.ts`) and the admin-on-behalf flow (`AdminSpaBookingModal.tsx`) write the *customer's* `user_id` and nothing about the actor. There is no `admin_action_log` entry either. Result: when a customer says "I didn't book this," we have no way to prove who did.

## Fix — Part A: Booking attribution (database + both insert paths)

### Schema (migration)
Add to `spa_appointments`:
- `created_by_user_id UUID NULL` — `auth.uid()` of whoever ran the insert
- `created_via TEXT NULL` — one of `'member_portal'`, `'non_member_portal'`, `'admin_booking'`, `'walk_in_guest'`
- `created_by_admin_name TEXT NULL` — denormalized snapshot ("Bridget S.") so old admin labels survive even if staff later leave

Backfill is optional — leave existing rows NULL; they'll display "Source unknown" in the UI.

### Insert paths
- **`src/hooks/useSpaBooking.ts`** (member/non-member self-service): set `created_by_user_id = user.id`, `created_via = 'member_portal'` (or `'non_member_portal'` based on whether a `members` row exists for the user).
- **`src/components/admin/spa/AdminSpaBookingModal.tsx`** (admin on behalf): set `created_by_user_id = currentAdmin.id`, `created_via = 'admin_booking'` (or `'walk_in_guest'` when no `userIdToInsert`), and `created_by_admin_name` from the current admin's profile.

## Fix — Part B: Always-resolves name + visible source label

### `src/hooks/useAdminSpaAppointments.ts`
- When the `non_member_profiles` fallback returns nothing for a `user_id`, also try a direct `auth.users` email lookup via an existing SECURITY DEFINER RPC (or fall back to `profiles` if available) so we never lose the name to RLS.
- Join `created_by_user_id` against members/non_member_profiles/profiles to build a `bookedBy` field: `{ name, role: 'self' | 'admin' | 'unknown' }`.

### `src/pages/admin/Appointments.tsx` and `src/components/admin/spa/SpaAvailabilityTab.tsx`
- Replace the `|| 'Guest'` fallback with `|| 'Name unavailable'` (only ever shown if every lookup fails — should be rare).
- Under each appointment card, add a small muted line:
  - `Booked by member` (when `created_by_user_id == user_id`)
  - `Booked by Bridget S. (admin)` (when admin booked on behalf)
  - `Booked by walk-in / front desk` (no user_id)
  - `Source unknown` (legacy rows pre-migration)

### `src/components/admin/spa/SpaCompletionDialog.tsx`
- Same `'Guest'` → `'Name unavailable'` change for consistency.

## Out of scope (intentionally not doing)
- No cancellations, no refunds — per your instruction, both Rola appointments stay as-is.
- No duplicate-prevention guard right now (the same-minute double-booking pattern is suspicious but you didn't ask for that — happy to add it in a follow-up if you want).

## Files touched
- New migration: `spa_appointments` columns
- `src/hooks/useSpaBooking.ts`
- `src/components/admin/spa/AdminSpaBookingModal.tsx`
- `src/hooks/useAdminSpaAppointments.ts`
- `src/pages/admin/Appointments.tsx`
- `src/components/admin/spa/SpaAvailabilityTab.tsx`
- `src/components/admin/spa/SpaCompletionDialog.tsx`

## How to verify
1. Book a spa appointment from the member portal as a non-member account → admin Appointments shows real name + "Booked by member."
2. Book a spa appointment from `AdminSpaBookingModal` for that same account → admin Appointments shows real name + "Booked by [your admin name] (admin)."
3. Existing rows (Rola's two appointments) continue to display her name correctly and show "Source unknown" until one of them is touched.
