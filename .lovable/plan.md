

# Fix Staff Portal Access + Rebuild as Department Workspaces

## Root Cause Analysis

I've identified three critical bugs preventing staff access, plus the redesign you want.

### Bug 1: Staff invite emails never sent
The `email_audit_log` has zero `staff_invite` entries and the edge function logs are empty. All 3 invites (Megan, Duha, Storm) are still "pending" — the emails never reached them. The email domain is not configured, which means the Resend integration may be sending from an unverified domain (`admin@stormwellnessclub.com`), causing silent failures.

### Bug 2: Only YOU have any roles in the system
The `user_roles` table has exactly 1 row — your `super_admin` role. Because invites were never claimed, the `auto_assign_staff_roles_on_signup` trigger never fired for anyone else. Even if staff created accounts independently, they'd have no roles and get "Access Denied."

### Bug 3: RLS and permission gaps for non-admin roles
- `class_instructor` is missing from the `class_bookings` RLS policies — instructors can't see their rosters
- 12+ routes in the app are missing from `PAGE_PERMISSIONS` (`/admin/check-in-history`, `/admin/scanner`, `/admin/cafe-menu`, `/admin/front-desk`, `/admin/equipment`, `/admin/agreements`, `/admin/emails`, `/admin/payment-tracking`, etc.) — any non-super-admin hitting those pages gets silently redirected
- `cafe_staff` can't update orders (no UPDATE policy includes them)

---

## Plan

### Phase 1: Fix access blockers (must do first)

**1a. Fix email delivery for staff invites**
- Add error handling and fallback logging in `InviteStaffDialog.tsx` so failures are visible
- Add a "Resend Invite" button on pending invites so you can retry
- Add a "Copy Invite Link" fallback that generates the activation URL (`/auth?staff_invite=true&redirect=/admin`) so you can manually share it while email is being sorted out

**1b. Fix PAGE_PERMISSIONS gaps**
Update `src/lib/permissions.ts` to add all missing routes:
- `/admin/check-in-history` — front_desk, manager, admin, super_admin
- `/admin/scanner` — front_desk, manager, admin, super_admin
- `/admin/cafe-menu` — cafe_staff, admin, super_admin
- `/admin/front-desk` — front_desk, spa_staff, manager, admin, super_admin
- `/admin/equipment` — manager, admin, super_admin
- `/admin/agreements` — manager, admin, super_admin
- `/admin/emails` — front_desk, manager, admin, super_admin
- `/admin/payment-tracking` — manager, admin, super_admin
- `/admin/members/:id` — front_desk, manager, admin, super_admin
- `/admin/class-roster/:sessionId` — class_instructor, front_desk, manager, admin, super_admin

**1c. Fix RLS policies for staff roles**
Database migration to add missing policies:
- `class_bookings`: Add SELECT + UPDATE for `class_instructor` (filtered by instructor's sessions)
- `class_sessions`: Add UPDATE for `class_instructor` (their assigned sessions only)
- `cafe_orders`: Ensure `cafe_staff` has INSERT/UPDATE/SELECT
- `profiles`: Add SELECT for `front_desk` role (they need to look up member profiles)
- `user_roles`: Add SELECT for `admin` role users to view staff (the `is_admin()` function already covers this, but verifying)

**1d. Add `canAccessPage` wildcard/pattern matching**
The current exact-match system fails for parameterized routes like `/admin/members/abc-123`. Update `canAccessPage` to match route patterns (e.g., `/admin/members/:id` matches `/admin/members/anything`).

### Phase 2: Rebuild staff portal with department workspaces

**2a. Staff management — separate invites from active staff**
Split `StaffRoles.tsx` into two tabs:
- **Active Staff** — current staff with roles (the existing table)
- **Pending Invites** — shows all pending invites with status, resend button, copy link button, and revoke option

**2b. Department-based sidebar navigation**
Restructure `AdminSidebar.tsx` into department workspaces that dynamically show based on roles:

```text
OPERATIONS (admin, manager, front_desk)
├── Dashboard
├── Check-In / Scanner
├── Directory
├── Members
├── Applications
├── Guest Passes / Guest Accounts
└── Support

CLASSES (admin, manager, class_instructor)
├── Today's Classes
├── Class Management
├── Instructors
└── Schedules

WELLNESS & SPA (admin, manager, spa_staff)
├── Appointments
└── Front Desk POS

CAFE & RETAIL (admin, manager, cafe_staff)
├── Cafe POS
├── Cafe Menu
└── Storm Shop Manager

CHILDCARE (admin, childcare_staff)
└── Childcare

FINANCE (admin, manager)
├── Payments
├── Payment Tracking
├── Payment Reports
├── Revenue Analytics
├── Reports
└── Member Credits

ADMINISTRATION (super_admin, admin)
├── Staff Management
├── Blocked Persons
├── Equipment
├── Agreements
├── Marketing
├── Settings
```

Each workspace section only renders if the user has at least one matching role. Collapsible groups with clear department headers.

**2c. Role-specific landing pages**
Update `getDefaultAdminPage()` and the `/admin` route to show a role-appropriate home:
- Admin/Manager: Full dashboard (existing)
- Front Desk: Check-in focused view
- Class Instructor: Today's classes with their assigned sessions highlighted
- Cafe Staff: Cafe POS directly
- Childcare: Childcare view directly

### Files to create/modify

| File | Action |
|------|--------|
| `src/lib/permissions.ts` | Add missing routes, fix pattern matching |
| `src/components/admin/ProtectedAdminRoute.tsx` | Update path matching for parameterized routes |
| `src/components/admin/AdminSidebar.tsx` | Restructure into department workspaces |
| `src/pages/admin/StaffRoles.tsx` | Add Pending Invites tab, resend/copy link |
| `src/components/admin/InviteStaffDialog.tsx` | Add copy-link fallback, better error handling |
| `src/components/admin/PendingInvitesTab.tsx` | New component for invite management |
| Database migration | Add RLS policies for class_instructor, cafe_staff, front_desk |

