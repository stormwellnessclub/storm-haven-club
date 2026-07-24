## Add delete for Class Types

Currently in Admin → Class Management you can create/edit/activate class types and delete individual schedules, but there's no way to delete a class **type**. Add that.

### Where to add the control

1. **Class Type Detail page** (`src/pages/admin/ClassTypeDetail.tsx`) — primary location. Add a red **Delete class type** button in the header actions area (next to Edit / Active toggle).
2. **Class Types list** (`src/pages/admin/ClassTypes.tsx` via `ClassTypeCard`) — add a small trash icon on each row for quick delete from the list.

### Behavior (safety-first)

Deleting a class type is destructive because sessions/bookings/passes may reference it. The button opens a confirm dialog that:

- Fetches counts: recurring schedules, upcoming sessions (session_date >= today, not cancelled), past sessions, total bookings.
- **Blocks hard delete** if there are **upcoming sessions with bookings** (`current_enrollment > 0`) or any active class passes tied to it. Shows a clear message: "Cannot delete — N members are booked in upcoming sessions. Cancel those sessions first."
- If safe, offers two choices:
  - **Deactivate instead** (recommended) — sets `is_active = false`. Hides from schedule/booking but preserves history. This is the default suggested action.
  - **Delete permanently** — only enabled when there are zero upcoming bookings. Cascades: delete `class_schedules` for this type, cancel/delete future empty sessions, then delete the `class_types` row. Past sessions are kept (they hold historical bookings) and the class type row can only be truly removed if no sessions reference it — otherwise we fall back to deactivate + explain.

### Implementation notes

- Add a `delete_class_type` SECURITY DEFINER RPC that runs the safety checks server-side and performs the cascade atomically. Admin/super_admin only.
- The client button calls the RPC and shows the returned summary (e.g., "Deleted class type, removed 3 schedules and 12 future empty sessions").
- After success: invalidate `class-types` / `class-schedules` queries and navigate back to `/admin/class-types`.
- No UI changes beyond adding the button + confirm dialog; existing layout and styling reused (shadcn `AlertDialog`, `Button variant="destructive"`).
