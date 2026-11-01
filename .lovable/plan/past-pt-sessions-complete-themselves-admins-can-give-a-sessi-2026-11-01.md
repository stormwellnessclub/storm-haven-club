# Past PT sessions complete themselves; admins can give a session back

## The rule
If a PT appointment is booked and not cancelled, the client came. Once the session's end time passes, it is marked completed and one session comes off their package automatically. No staff clicks needed.

## No double deduction
When you book a package session, the app sets one session aside ("held"). That's what the "session deducted" message means. When the session time passes, that same held session turns into a used one. It comes off **once**, never twice. To make this clearer:
- The booking message will say **"1 session held from package"**, not "deducted".
- The package will show three numbers: **Used**, **Held for upcoming**, and **Available**.
- Cancelling a booking in time gives the held session back.

## What changes
1. **Automatic completion for every booked session.** Today the hourly check only completes sessions already tied to a package at booking. Sessions booked without one (like Lora's Oct 26 session) are skipped. Now the check will:
   - Use the package already on the appointment, or else the client's active package with sessions left (same format, oldest expiring first).
   - Mark the session completed, deduct one session, and show it as "Paid · Package".
   - If the client has no package with sessions left, still mark it completed but leave it **Unpaid** so it shows up for billing (e.g. Wafa).
   - Never send emails or texts.
2. **Admin-only "Restore session."** On a completed package session, admins (and super admins) see a "Restore session" button. It asks for a short reason, puts the session back on the package, and marks the appointment "Session restored" so it stays in history. Front desk and trainers do not see it.
3. **One-time cleanup.** Run the new check once for past sessions still showing "scheduled" (Lora, Wafa, and Faten's two already-deducted June sessions get marked completed without deducting twice).

## Not changing
- Cancelled, late-cancel and no-show sessions are left alone.
- Manual "Complete" still works if you want to do it early.

## Technical details
- Extend `pt_auto_consume_past_reservations()` (hourly cron) to resolve a pass when `pass_id` is null, lock it, deduct via existing deduction path, and skip rows already `package_deducted`.
- New SECURITY DEFINER RPC `admin_restore_pt_session(appointment_id, reason)` gated by `has_role` admin/super_admin; increments pass, sets `package_deducted=false`, records `pt_pass_adjustments` + `pt_audit_log`.
- Button in `PTAppointmentDrawer.tsx`, shown only for admin roles.
- Test for the pass-selection rule and the admin-only restore check; update the PT rule in `AGENTS.md`.
