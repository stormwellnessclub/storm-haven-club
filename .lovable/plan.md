## Where the portal lives today

The Instructor Portal was built and is live at these routes (all gated by `ProtectedInstructorRoute`, which requires the `class_instructor`, `admin`, or `super_admin` role):

- `/instructor` — Today
- `/instructor/schedule`, `/rosters`, `/availability`, `/time-off`, `/subs`, `/notes`, `/pay`, `/messages`, `/documents`

Problems right now:
1. **No admin sidebar link** — admins have no way to preview or open the portal.
2. **No teacher entry point** — `/instructor` isn't linked anywhere and instructors don't know it exists.
3. **No role wiring** — creating a row in the `instructors` table does NOT grant `class_instructor` in `user_roles`, so even if a teacher logs in, `ProtectedInstructorRoute` blocks them with "Instructor access required."
4. **No onboarding email** — instructors aren't told they have a portal or how to log in.

## Plan

### 1. Admin access
- Add an **"Instructor Portal"** entry to `AdminSidebar.tsx` (under Staff / Classes) that opens `/instructor` in a new tab. Visible to `super_admin`, `admin`, `manager`. This lets you preview exactly what teachers see.
- On the existing `/admin/instructors` page, add a per-row **"Open portal as…"** link (super_admin only) and a **"Grant portal access"** action that:
  - Looks up the instructor's `auth.users` row by email
  - Inserts `class_instructor` into `user_roles` if missing
  - Shows a status badge on the row: *Portal access: granted / pending (no auth account) / not linked*

### 2. Teacher access
- Add a public **`/instructor-login`** landing route (simple branded page with email+password sign-in, "Forgot password", and copy: "Storm instructor portal — sign in with the email the studio has on file"). Redirects to `/instructor` on success.
- Auto-link on sign-in: a Postgres trigger on `auth.users` (insert/update) that, if the new user's email matches an `instructors.email` (case-insensitive), inserts `class_instructor` into `user_roles` and stamps `instructors.auth_user_id`.
- Backfill: run once for existing instructors with matching auth accounts.

### 3. Onboarding
- New edge function `send-instructor-welcome` that:
  - Creates the auth user via admin API (or sends a magic-link invite) using the instructor's email
  - Sends a branded email: welcome, portal URL (`https://stormwellnessclub.com/instructor-login`), what they can do there (schedule, rosters, sub requests, availability, pay, messages, documents), and a "Set your password" link.
- Trigger button on the admin Instructors page: **"Send portal invite"** per row, plus **"Send to all active"** in the header.

### 4. Discoverability
- Add "Instructor login" link to the public site footer (small, subtle) so teachers can find it without needing the URL emailed each time.

## Technical notes

- `class_instructor` already exists as an `app_role` enum value (used by `AdminSidebar` roles list and `ProtectedInstructorRoute`), so no enum migration needed.
- Auto-link trigger mirrors the existing member auth-linking pattern (`mem://auth/member-linking`).
- Welcome email uses the existing `send-transactional-email` flow with a new template `instructor-welcome` in `_shared/transactional-email-templates/`.
- No changes to portal pages themselves — they're already built.

## Deliverables checklist

- [ ] AdminSidebar link + admin "Grant access" / "Send invite" actions on `/admin/instructors`
- [ ] `/instructor-login` page + footer link
- [ ] Auth trigger + backfill migration linking `instructors` ↔ `user_roles`
- [ ] `instructor-welcome` email template + `send-instructor-welcome` edge function
- [ ] Quick QA: sign in as a test instructor, confirm portal loads
