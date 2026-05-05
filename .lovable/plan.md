## Goal

Give admin the ability to hold seats in a class session so they can't be booked publicly. Holds count against capacity (which is what blocks new bookings since the booking RPC checks `current_enrollment >= max_capacity`). Later, admin can either:
- **Convert** a held slot into a real attendee once they have the person's name/contact, or
- **Release** the hold to free the seat.

Works for any class session — not just fundraisers — but solves the immediate fundraiser need.

## What gets built

### 1. Schema change (small)
Add one column to `class_bookings`:
- `is_admin_hold boolean NOT NULL DEFAULT false`

This lets us distinguish placeholder seats from real walk-ins/bookings without overloading `walk_in_name` parsing.

### 2. Admin UI on Class Roster page (`src/pages/admin/ClassRoster.tsx`)

In the roster header (next to the existing "Add Attendee" / capacity controls), add a new **"Hold Slots"** button that opens a small dialog:

- Number input: "Hold N slots" (default 1, max = remaining capacity)
- Optional label field: "Note (optional)" — e.g. "Reserved at door, name pending"
- Action: **Hold N seats**

Behavior on submit:
- Inserts N rows into `class_bookings` with:
  - `status = 'confirmed'`
  - `payment_method = 'comp'`
  - `is_admin_hold = true`
  - `walk_in_name = 'HOLD — Pending #1'`, `#2`, … (or the admin's note)
  - `amount_paid = 0`
- Increments `current_enrollment` by N (same pattern as existing walk-in inserts).
- Toast confirms and refreshes roster + capacity.

For a **single hold** the same dialog with N=1 covers it — no separate flow needed.

### 3. Roster row treatment for holds

In the attendees table, rows where `is_admin_hold = true` get:
- A distinct amber **"HOLD"** badge instead of the usual type label.
- Two contextual actions replacing the normal check-in row:
  - **Convert** — opens a small inline form (first name, last name, phone, optional email). On save: clears `is_admin_hold`, sets `walk_in_name/email/phone`, keeps `payment_method = 'comp'` (admin can change to a real method later via the existing edit flow). If email matches an existing profile/member, it auto-links `user_id`/`member_id` (same logic the walk-in tab already uses).
  - **Release** — deletes the booking row and decrements `current_enrollment`. Same path as the existing remove-attendee mutation.

Holds are sorted to the top of the roster so they're easy to find.

### 4. Capacity banner

Above the roster, show a small summary line when holds exist:
> "X of Y seats held by admin — public booking shows class as full."

So you (and any other admin) immediately understand why a class looks fully booked.

## Why this works for the immediate fundraiser problem

- The two May 12 fundraiser sessions each have ~1–2 seats left (per your message). You open each session's roster, click **Hold Slots**, enter the remaining count, and the class is now fully reserved — no member can book it.
- As people send you their account info, you click **Convert** on a held row, fill in their details, and it becomes a normal confirmed attendee on the roster. Capacity stays the same; you don't have to release+re-add.
- If someone backs out, click **Release** — the seat opens up.

## Doesn't affect anything else

- The existing booking RPC and Stripe-payment RPC already block when `current_enrollment >= max_capacity`. No changes needed there.
- Holds use the same `class_bookings` table the roster already knows how to render, so reports, attendance, and the auto-heal counter logic continue to work. Reports can optionally filter `is_admin_hold = true` out later if you want — out of scope for this change.
- No member-facing UI changes. The fundraiser badge/donate flow built earlier is untouched.

## Files touched

- New migration: add `is_admin_hold` column + index.
- `src/pages/admin/ClassRoster.tsx`: Hold Slots dialog, Convert/Release actions, hold badge, capacity banner.
- `src/hooks/useRosterIdentity.ts`: include `is_admin_hold` when resolving attendees so the UI can render the badge.
