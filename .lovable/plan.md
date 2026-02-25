

## Comprehensive Staff Management Portal for Super Admins

### What Exists Today

The current "Staff Roles" page (`/admin/staff-roles`) is very basic:
- A grid of cards showing staff name, email, and role badges
- A small dialog to toggle roles on/off
- An invite dialog to send activation emails
- No way to view a staff member's profile in detail
- No way to delete/deactivate a staff member
- No activity tracking or audit trail
- No visibility into what actions a staff member has performed

### What We Will Build

A full **Staff Management** system following the same master-detail pattern used for Members and Non-Member Accounts. This will be built in phases:

---

### Phase 1: Staff Detail Page (Master-Detail View)

**New page: `/admin/staff-roles/:userId`**

A full-page staff profile with multiple sections:

**Header Section:**
- Staff name, email, phone (from profiles table)
- Status indicator (Active / Deactivated)
- Role badges
- "Edit Profile", "Deactivate", and "Delete" action buttons

**Profile Information Card:**
- First name, last name, email, phone -- editable inline
- Date added (from `user_roles.assigned_at`)
- Invited by (from `staff_invites.invited_by`)
- Account created date (from `profiles.created_at`)

**Roles Management Card:**
- All roles listed with checkboxes (same as current dialog but inline on the page)
- Save button to update roles
- Shows who assigned each role and when (`user_roles.assigned_by`, `assigned_at`)

**Activity Log Card (read-only tracking):**
- **Check-ins performed**: From `check_ins.checked_in_by` matching this staff user_id
- **Scans performed**: From `scanner_access_logs.scanned_by` matching this user_id
- **Spa appointments managed**: From `spa_appointments.staff_id`
- **Guest passes sold**: From `guest_passes.sold_by`
- **Guest passes checked in**: From `guest_passes.checked_in_by`
- Displayed as a chronological feed with date/time and action type
- Filterable by date range and action type

**Invite History Card:**
- Shows the original invite record from `staff_invites` (when invited, by whom, which roles were pre-assigned, status)

---

### Phase 2: Enhanced Staff List Page

**Upgrade `/admin/staff-roles` from cards to a table view:**

- Table columns: Name, Email, Roles, Status, Date Added, Last Active, Actions
- Click any row to navigate to the detail page (`/admin/staff-roles/:userId`)
- "Last Active" derived from the most recent entry in check_ins/scanner_access_logs by that user
- Status column showing Active/Deactivated badge
- Bulk actions are not needed initially

---

### Phase 3: Deactivate and Delete Staff

**Deactivate (soft removal):**
- Removes all roles from `user_roles` for that user
- Staff can no longer access any admin pages
- The profile and activity history remain for audit purposes
- A "Reactivate" button appears on deactivated profiles to re-add roles

**Delete (hard removal -- super_admin only):**
- Confirmation dialog with the staff member's name typed to confirm
- Deletes all `user_roles` records for the user
- Deletes the `staff_invites` record
- Does NOT delete the `profiles` record (the user account still exists, they just lose staff access)
- Activity history in `check_ins`, `scanner_access_logs`, etc. is preserved (foreign keys remain as historical data)

---

### Phase 4: Database -- Staff Activity Tracking View

Create a database view or query pattern to aggregate staff activity:

- Count of check-ins performed (today, this week, this month, all time)
- Count of scans performed
- Count of guest passes sold/checked in
- Last activity timestamp

No new tables are needed -- all data already exists in `check_ins`, `scanner_access_logs`, `guest_passes`, and `spa_appointments`. We just need to query them by the staff user's ID.

---

### Technical Details

#### Files to Create
- `src/pages/admin/StaffDetail.tsx` -- Full-page staff profile with all sections described above
- `src/components/admin/StaffActivityLog.tsx` -- Activity feed component querying check_ins, scanner_access_logs, guest_passes, spa_appointments by staff user_id
- `src/components/admin/StaffProfileCard.tsx` -- Editable profile information card
- `src/components/admin/StaffRolesCard.tsx` -- Inline roles management with assignment metadata

#### Files to Modify
- `src/pages/admin/StaffRoles.tsx` -- Convert from card grid to table view with clickable rows navigating to detail page
- `src/lib/permissions.ts` -- Add route permission for `/admin/staff-roles/:userId`
- `src/App.tsx` (or router config) -- Add route for `/admin/staff-roles/:userId`
- `src/components/admin/AdminSidebar.tsx` -- Rename "Staff Roles" to "Staff Management" in the sidebar

#### Database Changes
- No new tables needed
- No schema migrations required
- All activity data is already tracked in existing tables with staff user_id references (`checked_in_by`, `scanned_by`, `sold_by`, `checked_in_by`, `staff_id`)

#### Security
- Staff detail page restricted to `super_admin` and `admin` roles (same as current Staff Roles page)
- Delete action restricted to `super_admin` only
- All queries use existing RLS policies

