# Admin access to Instructor Portal

Goal: You (super admin, `storm@stormwellnessclub.com`) can enter `/instructor` and use it like any instructor — plus flip a switch to see & manage any other instructor's schedule/roster/pay. Regular instructors are unaffected.

## 1. Link your admin account to an instructor record

- Locate the instructor row where email is `storm@stormwellnessclub.com` (create one named "Storm Admin" if missing, `pay_type = per_class`, rates 0, `active = true`).
- Set its `user_id` to your admin auth user id so `/instructor` finds it.
- This is a data-only change — your admin role, permissions, and access to every other admin surface stay exactly as they are. Linking an instructor row does not touch `user_roles`.

## 2. Mode switcher in the Instructor Portal header

Only visible when the current user has `admin` or `super_admin` role. Rendered in `InstructorShell.tsx` top bar:

```text
[ Instructor mode ▼ ]   ← default: your own instructor view
    • My instructor view (Storm Admin)
    • View as: Duha A.
    • View as: [each active instructor]
    • ──
    • Admin mode  → jumps to /admin/instructors
```

- Selecting "View as: X" stores `viewAsInstructorId` in `sessionStorage` and reloads the portal pages against that instructor id.
- A slim gold banner appears while impersonating: `Viewing as Duha A. — Exit view-as`.
- Non-admin instructors never see the switcher or banner (guarded by `has_role` check via `useAuth` + a small `useIsAdmin` hook).

## 3. Data fetching changes

Update the instructor portal pages (`Today.tsx`, and the other `src/pages/instructor/*` pages that scope by `instructor_id`) so:

- If `viewAsInstructorId` is set AND caller is admin → use that id.
- Otherwise → look up instructor by `user_id = auth.uid()` (current behavior).

Admin-only RPC `admin_get_instructor_context(_instructor_id uuid)` returns the target instructor row and is called instead of the direct `instructors` select when impersonating. RLS on `class_sessions`, rosters, pay tables already allows admins to read all rows, so no policy changes needed.

## 4. "Almost there" empty state

Since your admin account will be linked to the Storm Admin instructor row, you'll never hit the "hasn't been linked" screen. Keep the screen for real instructors who truly aren't linked yet, but add a subtle admin-only escape hatch: if the viewer is admin and no instructor row is linked, show a button "Enter as admin (view any instructor)" that opens the switcher directly instead of blocking.

## Files touched

- DB (migration + insert): ensure instructor row for `storm@stormwellnessclub.com`, link `user_id`; add `admin_get_instructor_context` RPC.
- `src/components/instructor/InstructorShell.tsx`: mode switcher, impersonation banner, admin gate.
- `src/hooks/useInstructorContext.ts` (new): resolves effective instructor id (self vs. view-as) and exposes `isAdmin`, `isImpersonating`.
- `src/pages/instructor/Today.tsx` (and siblings): consume `useInstructorContext` instead of doing their own lookup.
- No changes to regular-instructor UX, no changes to admin sidebar, no changes to `user_roles`.

## Out of scope

- No new admin-only editing surfaces inside the instructor portal (edits still happen in `/admin/instructors` and `/admin/classes`). Ask if you want inline edit next.
