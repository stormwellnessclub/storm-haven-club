
# Front Desk Dashboard — Phase 1

Goal: a dedicated `/frontdesk` app for front-desk staff. Shared kiosk PIN unlocks the device, then each staffer clocks in with **their own personal PIN** so payroll knows exactly who worked and when. Zero access to admin dashboard, financials, applications, staff management, or reports — even by URL guessing or hitting the back button.

---

## 1. New route: `/frontdesk`

A brand-new top-level section, **NOT** under `/admin`. Nothing here shares a layout, sidebar, or navigation with `/admin`, so there is no back-button leak into admin.

Routes:
- `/frontdesk` → Device PIN gate → Staffer clock-in (personal PIN) → Reception (check-in) home
- `/frontdesk/pos` → Member lookup + charge card on file + sell class pass / guest pass
- `/frontdesk/schedule` → Today's classes + rosters (view + mark walk-in only)
- `/frontdesk/shift` → Current shift status, clock in/out via personal PIN

Anything else (`/frontdesk/reports`, `/frontdesk/settings`, etc.) → 404 inside the front-desk shell.

## 2. Three-layer access model

1. **Device gate — shared kiosk PIN (0201)**. Unlocks the tablet for the day. Same as today.
2. **Shift gate — personal staffer PIN (clock in / clock out).**
   - Clock IN: staffer taps "Clock In", picks their name from the front-desk roster, enters **their personal PIN** → shift starts, they're stamped on every action.
   - Clock OUT: staffer taps "End Shift", re-enters **the same personal PIN** to confirm → shift closes.
   - Same PIN for clock in and clock out (the PIN is the person, not the action). You've said you already set the codes — I'll load them into a new `staff_pins` table (PIN stored hashed, never in plain text).
   - "End Shift" or 30-min idle drops back to the staffer picker (device stays PIN-unlocked).
   - If two people work the same shift, each has their own PIN and each has their own open clock — the app just shows the last person to clock in as "on desk right now", but both timesheets are recorded independently.
3. **Role gate — server-side**. All front-desk RPCs require the `front_desk` role (or admin/manager override). `front_desk`-only accounts hitting `/admin/*` get hard-redirected to `/frontdesk` (today it sends them to `/kiosk/reception`).

## 3. Clock in / out for payroll

New table `staff_shift_clocks` records every clock event:
- `staff_user_id`, `clock_in_at`, `clock_out_at`, `device_label`, `notes`, `auto_closed` flag

Payroll view sums hours per staffer per week. Front desk staff see only their own timesheet; admin/manager sees everyone's.

Safety nets:
- If someone forgets to clock out, auto clock-out at 11:59pm club time flagged for admin review the next morning.
- Admin can edit/adjust a shift after the fact (with an audit trail).
- Personal PIN can be rotated by an admin from `/admin/staff-roles/:userId` (out of scope for the visible UI in Phase 1 beyond a "Reset PIN" button — actual admin CRUD polish comes next phase).

## 4. What front desk CAN do (Phase 1)

- **Check-in** — members, guests, class attendees, spa guests (reuses existing reception flow).
- **Today's class schedule + rosters** — view + mark walk-in, no schedule editing.
- **Sell a class pass** — single or multi, to member or non-member.
- **Sell a guest pass** — existing sale flow.
- **Look up a member & charge card on file** — manual charge / POS, no discount overrides.

If any of the sales/POS items should be cut from Phase 1, tell me before I build.

## 5. What front desk CANNOT do (hard walls)

- No `/admin/dashboard`, revenue, payment reports, reconciliations
- No applications, freezes, refunds, credit adjustments, discount overrides
- No staff management, staff schedule, staff hub, roles, invites
- No marketing, emails, campaigns, SMS, automations
- No cancelling/deleting bookings for other members (only mark walk-in / check-in)
- No viewing another member's full payment history or subscription internals — POS shows current balance / card on file only
- No app settings, agreements, class type/schedule editing, instructors, equipment, blocked persons

Enforced two ways: front-desk shell has zero navigation into those pages, AND the `/frontdesk/*` URL space excludes them. Server-side, single-role `front_desk` accounts get bounced from `/admin/*` before render, and RLS/RPC role checks continue to block direct API calls.

## 6. UI shape

Front-desk shell (top bar, no admin sidebar):

```text
+-----------------------------------------------------------------+
| STORM • Front Desk    [Reception] [POS] [Schedule]   Amal · 3h  |
|                                                     [End Shift] |
+-----------------------------------------------------------------+
|   (page content — Reception check-in by default)                |
+-----------------------------------------------------------------+
```

- Top-right chip: currently clocked-in staffer + live shift duration.
- "End Shift" prompts for their personal PIN, clocks them out, returns to staffer picker.
- No link, breadcrumb, or button anywhere leads into `/admin`.

## 7. Technical details

- New folder `src/pages/frontdesk/` with `Layout.tsx`, `Reception.tsx`, `POS.tsx`, `Schedule.tsx`, `Shift.tsx`, `ClockInGate.tsx`.
- New `FrontDeskShellProvider` — mirrors `BareAdminLayoutProvider` but with front-desk chrome only.
- New `ProtectedFrontDeskRoute` — requires signed-in-or-service session + open shift clock. Missing shift → clock-in gate. Wrong role → `/`.
- Migration adds:
  - `public.staff_shift_clocks` with `authenticated`/`service_role` GRANTs, RLS: staffer reads own rows, admin/manager reads all, writes only via SECURITY DEFINER RPCs `frontdesk_clock_in(_pin)` / `frontdesk_clock_out(_pin)`.
  - `public.staff_pins` (user_id, pin_hash, updated_at) — `service_role`-only, no direct client access. Plus `verify_staff_pin(_pin) returns uuid` SECURITY DEFINER function that returns the matching staff user_id if the PIN is valid, else null. **Rate-limited** (5 failed attempts / 15 min per device) to prevent brute forcing 4-digit PINs.
  - Cron job for the 11:59pm auto-close sweep.
- Reuses existing components: `KioskPinGate`, `FrontDesk` search + attendance panels, `FrontDeskPOS`, class roster components. No duplicated logic.
- `ProtectedAdminRoute` update: single-role `front_desk` accounts redirect to `/frontdesk` instead of `/kiosk/reception`.
- Existing `/kiosk/reception` stays for the anonymous shared-tablet flow at rush moments; `/frontdesk` becomes the primary desk experience.

## 8. About the PIN codes you set up

Once this ships I'll ask you to paste each staffer's PIN into a secure form (one per person) so I can hash and load them into `staff_pins`. **Do not** paste PINs into the chat — I'll pop the secure form when we get there.

## 9. Out of scope (future phases)

- Cafe-staff-only dashboard (next after this).
- Payroll export / approval workflow beyond raw hours.
- Break tracking, overtime rules, geofencing.
- Full admin UI for editing shifts / resetting PINs (basic reset button only in Phase 1).

---

Ready to build on approval. If you want any Phase 1 tool cut (e.g. hold POS and ship check-in + schedule + clock-in first), say so and I'll trim before implementing.
