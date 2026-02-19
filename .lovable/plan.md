

# Staff Invite System + Fix Duha's Email

## What This Does
1. Updates Duha's email to `duha@stormwellnessclub.com` in the database
2. Builds a staff invite flow so admins can send a branded activation email with a direct signup link
3. Pre-assigns the role so when the invited staff member creates their account, they automatically get the correct role

## How It Works

### Staff Invite Flow
1. Admin opens the **Staff Roles** page and clicks "Add Staff Member"
2. A dialog appears asking for: **email**, **first name**, **last name**, and **role(s)** to assign
3. Admin clicks "Send Invite" which:
   - Creates a record in a new `staff_invites` table (email, roles, invited_by, status)
   - Sends a branded email via the existing `send-email` function with a link to `/auth?staff_invite=true`
4. When the staff member clicks the link and creates an account:
   - A database trigger matches their email against `staff_invites`
   - Automatically inserts the pre-assigned role(s) into `user_roles`
   - Marks the invite as "claimed"

### What Duha Sees
- She receives a branded email: "You've been invited to join Storm Wellness Club as a Class Instructor"
- She clicks the link, creates her account with `duha@stormwellnessclub.com`
- She's automatically given the `class_instructor` role
- She logs in and lands on `/admin/classes` showing her Reformer Pilates schedule

## Technical Details

### Database Changes
1. **Update instructor email**: Change Duha's email from `duha@stormclub.com` to `duha@stormwellnessclub.com`
2. **New table: `staff_invites`**
   - `id` (uuid, primary key)
   - `email` (text, not null)
   - `first_name` (text)
   - `last_name` (text)
   - `roles` (app_role array)
   - `invited_by` (uuid, references auth.users)
   - `status` (text: 'pending', 'claimed', 'expired')
   - `created_at`, `claimed_at`
   - RLS: only admin/super_admin can insert/select
3. **New trigger: `auto_assign_staff_roles_on_signup`**
   - Fires after insert on `profiles`
   - Matches email against pending `staff_invites`
   - Inserts matching roles into `user_roles`
   - Updates invite status to 'claimed'

### New Email Template
- Add `staff_invite` type to the `send-email` edge function
- Branded email with the Storm Wellness Club styling
- Contains: welcome message, role description, and a "Create Your Account" button linking to `/auth?staff_invite=true`

### Frontend Changes
- **`src/pages/admin/StaffRoles.tsx`**: Wire up the "Add Staff Member" button to open an invite dialog with email, name, and role selection fields. On submit, insert into `staff_invites` and call the `send-email` function.
- **`src/pages/Auth.tsx`**: Detect `staff_invite=true` query param to show a subtle "Staff Account Setup" banner so the person knows they're in the right place.

