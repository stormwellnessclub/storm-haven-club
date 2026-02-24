

## Build a Proper Staff Portal with Smart Routing

### The Problem Today

When you invite a staff member and they sign up, here is what happens:

1. They click "Create Your Account" in the invite email, which takes them to `/auth?staff_invite=true`
2. They create their account, the database trigger assigns their roles automatically
3. The Auth page redirects them to `/member` (the default)
4. `ProtectedMemberRoute` checks their membership status, finds none, and redirects them to `/portal` (the non-member class pass portal)
5. They land in a portal designed for class pass customers -- not staff

Staff members have no clear path to their admin workspace. They would need to manually navigate to `/admin` in the URL bar.

### The Solution (Multi-Step)

Build a proper post-login routing system that detects staff roles and sends them directly to the right place, plus a dedicated staff onboarding experience.

---

### Step 1: Smart Post-Login Routing

**Problem:** The Auth page always defaults to `/member` after login.

**Fix:** After successful login, check if the user has staff roles. If they do, route them to their appropriate admin page instead of the member portal.

- In `Auth.tsx`, after login/signup, query `user_roles` for the logged-in user
- If roles exist, redirect to the correct admin landing page using the existing `getDefaultAdminPage()` function (e.g., front desk goes to `/admin/check-in`, instructors go to `/admin/classes`, admins go to `/admin`)
- If no roles exist, continue with the current member/portal flow
- The staff invite email link will change from `/auth?staff_invite=true` to `/auth?staff_invite=true&redirect=/admin` so the intent is clear even before roles are checked

### Step 2: Update the Staff Invite Email

**Problem:** The invite email sends staff to a generic auth page with no context about where they will end up.

**Fix:** Update the `staff_invite` email template in the `send-email` edge function to:
- Include the specific role(s) they are being assigned
- Set the CTA link to `/auth?staff_invite=true&redirect=/admin`
- Add a line like "Once your account is created, you will be taken directly to your staff dashboard"
- Update the email footer to remove member-portal-specific links (use the receipt footer instead)

### Step 3: Post-Signup Staff Welcome Screen

**Problem:** After signing up, staff may need to sign the liability waiver (which currently shows a generic member-facing waiver screen) and have no orientation.

**Fix:** Create a lightweight staff welcome/onboarding component:
- After signup + role detection, show a brief "Welcome to the Team" screen instead of the generic waiver step
- Display their assigned role(s) with descriptions of what they can access
- Show a "Go to Your Dashboard" button that routes to their `getDefaultAdminPage()`
- If a waiver is still required, integrate it into this flow but with staff-appropriate messaging

### Step 4: Protect Staff from Member/Portal Routing Traps

**Problem:** `ProtectedMemberRoute` and `ProtectedPortalRoute` can intercept staff members who navigate to `/member` and bounce them around.

**Fix:**
- In `ProtectedMemberRoute`: If the user has staff roles but no member record, redirect to `/admin` (their default admin page) instead of `/portal`
- In `ProtectedPortalRoute`: Already allows staff through, but add awareness so staff with roles are subtly guided to `/admin` if they land on `/portal` by accident
- This ensures that no matter how a staff member arrives, they always end up in the right place

### Step 5: Staff Quick-Switch in Admin Sidebar

**Problem:** Staff who are also members (e.g., an instructor who has a gym membership) have no easy way to switch between their admin view and member view.

**Fix:**
- Add a "Member Portal" link in the admin sidebar footer (only visible if the staff member also has an active membership)
- This is already partially there with "Back to Website" -- add a conditional "My Membership" link next to it

---

### Technical Details

#### Files to Create
- `src/components/staff/StaffWelcome.tsx` -- Post-signup welcome screen for new staff

#### Files to Modify
- `src/pages/Auth.tsx` -- Add post-login role detection and smart routing
- `src/components/member/ProtectedMemberRoute.tsx` -- Add staff-role fallback routing to `/admin`
- `src/components/admin/AdminSidebar.tsx` -- Add conditional "My Membership" link
- `supabase/functions/send-email/index.ts` -- Update `staff_invite` template with better CTA link and messaging

#### No Database Changes Required
The existing `staff_invites` table, `user_roles` table, and `auto_assign_staff_roles_on_signup` trigger are all correctly set up. This is purely a frontend routing and UX improvement.

#### Routing Logic Summary

```text
User logs in
  |
  +-- Has staff roles?
  |     |
  |     +-- YES --> Staff Welcome (first login) or getDefaultAdminPage()
  |     |             - super_admin/admin/manager --> /admin
  |     |             - front_desk --> /admin/check-in
  |     |             - spa_staff --> /admin/appointments
  |     |             - class_instructor --> /admin/classes
  |     |             - cafe_staff --> /admin/cafe
  |     |             - childcare_staff --> /admin/childcare
  |     |
  |     +-- NO --> Has member record?
  |                 |
  |                 +-- YES --> /member
  |                 +-- NO --> /portal (non-member class pass portal)
```

