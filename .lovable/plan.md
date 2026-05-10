## Goal

Let you add a person to staff scheduling **without** triggering the invite email / activation link. They'll show up in the Staff Schedule team list and can be assigned shifts immediately. Later, when you're ready, you can promote them into a real invite.

## How it will work

Right now "Add Staff Member" only creates a row in `staff_invites`, which is geared toward sending an activation email and creating a real login. The Staff Schedule already supports non-user people via the `person_ref` column on `staff_shifts` — we'll plug a new "placeholder staff" concept into that path.

### 1. New `staff_placeholders` table

A lightweight roster of schedulable people who don't have (and don't need) a login yet.

Fields:
- first name, last name, email (optional), phone (optional)
- roles (same `app_role[]` as invites, used only for grouping in the schedule)
- notes (optional)
- created_by, archived flag

Admins/super_admins can manage these rows (RLS via `has_any_role`).

### 2. Surface them in the schedule

`useTeamMembers` already merges staff + instructors + therapists into one list keyed by `user_id` or `ref:<email>`. We'll add a fourth source: rows from `staff_placeholders`, keyed as `ref:placeholder:<id>`, grouped by their assigned role (Managers / Front Desk / Instructors / Therapists / etc.) with a small "Unactivated" badge so you can tell them apart.

When you assign a shift, `staff_shifts.person_ref` is set to that same `ref:placeholder:<id>` and `person_name` is filled in — no changes needed to the shift schema, it already supports this.

### 3. UI changes

**Staff Management page (`/admin/staff-roles`):**
- Split the top button into two:
  - **"Add to Schedule"** (primary) — opens a small dialog that only collects first/last name, optional email/phone, and role(s). Creates a `staff_placeholders` row. No email sent, no auth account, no activation link.
  - **"Send Invite"** (secondary) — the existing `InviteStaffDialog` flow, unchanged.
- New third tab **"Unactivated"** listing placeholder staff with edit / archive / "Send invite now" actions. "Send invite now" pre-fills `InviteStaffDialog` with their details, and on successful claim the placeholder is archived/merged.

**Staff Schedule page (`/admin/staff-schedule`):**
- Placeholders appear in the team list/grid like any other member. A subtle "Unactivated" pill next to the name makes it clear they don't have a login yet.
- Shift creation in `ShiftDialog` works against them unchanged via `person_ref`.

### 4. What stays the same

- No changes to `staff_shifts`, `staff_invites`, `user_roles`, or the existing invite email flow.
- Existing instructors/therapists logic is untouched.
- Permissions: only admin/super_admin can create or edit placeholders.

## Technical details

- New migration: `staff_placeholders` table + RLS (`has_any_role(auth.uid(), ARRAY['super_admin','admin'])` for all actions) + `updated_at` trigger.
- `useTeamMembers.ts`: fetch placeholders in parallel, fold into `byKey` with `key = "ref:placeholder:" + id`, `user_id = null`, group from first role.
- New `AddPlaceholderStaffDialog.tsx` for the lightweight add form.
- `StaffRoles.tsx`: add second button + "Unactivated" tab + "Send invite now" handoff (pre-fills `InviteStaffDialog` and archives placeholder once claimed).
- `TeamMember` type gets an optional `isPlaceholder: boolean` so the schedule UI can render the badge.
- Optional follow-up (not in this plan): when a placeholder's email later matches a claimed invite/profile, auto-archive and re-point their existing shifts' `person_ref` → `user_id`. Happy to add this if you want, but it's not required for scheduling to work.

## Open question

When you eventually "Send invite now" from a placeholder and they activate their account, do you want their already-scheduled shifts to automatically re-link from `person_ref` to their new `user_id`? (Recommended — keeps history clean. If yes, I'll include the link-on-claim trigger in the same migration.)