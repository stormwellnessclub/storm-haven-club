# Front Desk Kiosk: Fix Class Check-In + Add Kids Care Check-In

## Problems Found

### 1. Class roster makes checked-in members "disappear" instead of showing as checked in
- `kiosk_check_in_class(p_booking_id)` writes `status = 'completed'` after a successful kiosk check-in.
- `kiosk_class_roster(p_session_id)` only returns rows where `status IN ('confirmed', 'checked_in')`.
- Result: as soon as a staff member clicks **Check In** in the expanded class roster, the person vanishes from the list. There's no green "In" badge, no confirmation in the roster — staff perceive this as "I can't check them in."
- Function works on the backend; the UI just hides the result.

### 2. Kids Care has no check-in (or check-out) action at the front desk
- `TodaysKidsCare` in `src/pages/FrontDesk.tsx` is read-only — it shows the child / parent / time / status, but no buttons.
- The kiosk runs as **anon** (PIN-gated, no Supabase auth user). Direct `kids_care_bookings` UPDATEs are blocked by RLS (`has_any_role(...)` requires an authenticated staff user), and the existing `useUpdateKidsCareBookingStatus` hook depends on `auth.uid()`.
- Need a `SECURITY DEFINER` RPC (mirroring `kiosk_check_in_class` / `kiosk_check_in_spa`) so the kiosk can flip Kids Care bookings to `checked_in` and `checked_out`.

---

## Plan

### A. Backend (one new migration)

**1. Update `kiosk_class_roster`** to include `'completed'` so checked-in attendees stay visible with the green "In" badge:
- Change the WHERE filter to `cb.status IN ('confirmed', 'checked_in', 'completed')`.
- The frontend already keys "checked in" off `checked_in_at`, so the badge will render correctly.

**2. Add `kiosk_check_in_kids_care(p_booking_id uuid) RETURNS jsonb`**
- `SECURITY DEFINER`, `SET search_path = public`.
- Sets `status = 'checked_in'`, `checked_in_at = now()`, `updated_at = now()` where the booking is currently `confirmed` (or `pending`) and `checked_in_at IS NULL`.
- Returns `{ success, error? }`.
- `GRANT EXECUTE ... TO anon, authenticated`.

**3. Add `kiosk_check_out_kids_care(p_booking_id uuid) RETURNS jsonb`**
- Same shape; sets `status = 'checked_out'`, `checked_out_at = now()`, `updated_at = now()` where status is currently `'checked_in'`.
- Returns `{ success, error? }`.
- Granted to `anon` and `authenticated`.

**4. Add a roster RPC for Kids Care** so the kiosk can fetch a shaped, RLS-bypassing list:
- `kiosk_kids_care_roster(p_booking_date date) RETURNS jsonb` — returns id, child_name, parent name, age_group, start_time, end_time, status, checked_in_at, checked_out_at.
- Granted to `anon` and `authenticated`.
- (Today's table calls `get_admin_kids_care_bookings`, which may not be `anon`-callable — using a dedicated kiosk RPC keeps the same security pattern as classes/spa.)

### B. Frontend — `src/hooks/useKioskCheckIn.ts`
- Add `checkInKidsCare(bookingId: string)` and `checkOutKidsCare(bookingId: string)` functions, mirroring `checkInClass`/`checkInSpa`. Both call the new RPCs and surface toasts on failure.

### C. Frontend — `src/pages/FrontDesk.tsx` (`TodaysKidsCare` component)
- Switch the data source to `supabase.rpc("kiosk_kids_care_roster", { p_booking_date: today })` so it works under anon.
- Add a per-row action column:
  - `confirmed` / `pending` → **Check In** button (primary).
  - `checked_in` → green "In" badge **+** "Check Out" button.
  - `checked_out` → muted "Checked out" badge (no action).
  - `cancelled` / `no_show` → muted badge (no action).
- On success: toast + `queryClient.invalidateQueries(["kiosk-todays-kidscare"])`.
- Show parent phone (if available from RPC) so staff can verify the pickup adult — small but high-value at a real front desk.

### D. Frontend — `src/components/kiosk/KioskClassRoster.tsx`
- No code change required — once the roster RPC includes `'completed'`, the existing `isCheckedIn = !!entry.checked_in_at` branch will render the green "In" badge correctly.
- Add one safety improvement: after a successful check-in, also invalidate `["kiosk-todays-classes"]` (already done) so the enrollment counts on the parent card stay fresh.

---

## Files Affected
- **New migration**: roster filter fix + 3 new RPCs (`kiosk_check_in_kids_care`, `kiosk_check_out_kids_care`, `kiosk_kids_care_roster`) with grants.
- `src/hooks/useKioskCheckIn.ts` — add two new methods.
- `src/pages/FrontDesk.tsx` — rewrite `TodaysKidsCare` to use the kiosk RPC and add Check In / Check Out buttons.

## Out of Scope (for this change)
- The pending "good standing" guard on freeze requests.
- Removing **Request Tour** (still waiting on your details).
- Any change to the `/admin/childcare` staff page — that already has check-in via the authenticated path and continues to work.

Ready to implement on approval.