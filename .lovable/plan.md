# Unblock front desk + ship Staff PIN admin page

## Part 1 — Skip clock-in (temporary bypass)

The `/frontdesk` shell has two gates today:
1. Shared kiosk PIN (already set)
2. `ClockInGate` → `frontdesk_clock_in` RPC → matches a `staff_pins` row

Gate #2 blocks everything until at least one row exists in `staff_pins`. Fix:

- **`src/pages/frontdesk/FrontDeskShell.tsx`** — add a bypass shift when the user chooses to skip. Store a synthetic shift in `sessionStorage` under `SHIFT_KEY` with `shiftId: "bypass"`, `staffUserId: <current auth user id or "unassigned">`, `staffName: "Unassigned (bypass)"`, so the rest of the shell renders normally.
- **`src/pages/frontdesk/ClockInGate.tsx`** — add a small secondary link under the keypad: **"Skip clock-in for now →"**. Clicking it fires `onClockedIn` with the bypass payload and shows a toast: *"Clock-in tracking is off. Shift hours won't be recorded until Staff PINs are set up."*
- **Header badge** — while `shift.shiftId === "bypass"`, show an amber "Tracking off" badge instead of the green live pill so it's obvious at a glance.
- **`useActiveFrontDeskShift`** — unchanged; downstream code that tags actions with `clocked_in_staff_id` should tolerate `"bypass"` (no DB writes to `staff_shift_clocks`).

Nothing here changes RLS, RPCs, or payroll data. Once real PINs exist, staff use them normally and the bypass link becomes something you ignore.

## Part 2 — Staff PIN admin page

### Database

Two new SECURITY DEFINER RPCs on `staff_pins`, admin/manager only. They reuse whatever hash scheme `frontdesk_clock_in` already validates against (I'll match it exactly in build mode — the table has `user_id`, `pin_hash`, `updated_at`, `updated_by`).

- `admin_set_staff_pin(_user_id uuid, _pin text) returns void`
  - Requires caller has `admin` or `manager` role via `has_any_role`.
  - Validates `_pin` is 4–8 digits.
  - Upserts hashed PIN, sets `updated_by = auth.uid()`, `updated_at = now()`.
- `admin_clear_staff_pin(_user_id uuid) returns void`
  - Same role gate. Deletes the row.

No new tables. `GRANT EXECUTE` on both to `authenticated`.

### UI — new page `src/pages/admin/StaffPins.tsx`

Route: `/admin/staff-pins`. Sidebar entry under **Staff Management** ("Staff PINs" with a keypad icon).

Layout — single dense table (matches project's admin CRM style):

| Staff member | Role(s) | PIN status | Last set | Actions |
| --- | --- | --- | --- | --- |
| Alice Smith | front_desk | ✅ Set | 2 days ago | Reset / Clear |
| Bob Jones | manager, admin | — Not set | — | Set PIN |

Data source: `frontdesk_staff_roster` RPC (already exists) joined with `staff_pins` to derive status. Only lists users with `front_desk`, `manager`, `admin`, or `staff` roles.

Dialog on **Set PIN / Reset**:
- Two numeric inputs: enter PIN + confirm PIN.
- Client-side validate (4–8 digits, match).
- Call `admin_set_staff_pin`; toast success.
- Warn (not block) if the PIN is trivial (`0000`, `1234`, sequential/repeating).

**Clear** action confirms then calls `admin_clear_staff_pin`.

Permissions: page and sidebar entry gated to `admin` and `manager` via `canAccessPage` in `src/lib/permissions.ts`.

### Files touched

- `src/pages/frontdesk/FrontDeskShell.tsx` — bypass shift plumbing + amber badge.
- `src/pages/frontdesk/ClockInGate.tsx` — "Skip clock-in for now" link.
- Migration — two RPCs above.
- `src/pages/admin/StaffPins.tsx` — new page.
- `src/App.tsx` — route registration.
- Admin sidebar component — new entry under Staff Management.
- `src/lib/permissions.ts` — allow `admin`/`manager` on `/admin/staff-pins`.

## Out of scope

- Rotation policy, PIN expiry, lockout after N failed attempts — can queue as follow-ups if you want them.
- Editing time-clock entries (`staff_shift_clocks` adjustments) — separate task.
