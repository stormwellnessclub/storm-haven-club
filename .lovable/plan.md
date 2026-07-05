# Fix: Freed spots not returned when member self-cancels

## The bug
When a member early-cancels a class booking through the portal/member app, `class_bookings.status` is set to `cancelled` and the credit/pass is refunded, but `class_sessions.current_enrollment` is **not** decremented. Admin removals already recompute enrollment correctly — only the member self-cancel RPC misses this step.

Result: the schedule keeps showing the cancelled member's seat as taken (e.g. "4 spots left of 5" instead of "5 spots left").

## Fix
Update the `cancel_class_booking` RPC (defined in `supabase/migrations/20260323100153_...sql`) via a new migration so it also recomputes the session's enrollment count after cancelling.

Add — right after the `UPDATE class_bookings SET status = 'cancelled' ...` block — a recompute step that mirrors the admin-side logic in `ClassRoster.tsx`:

```sql
UPDATE public.class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*)
  FROM public.class_bookings b
  WHERE b.session_id = cs.id
    AND b.status IN ('confirmed', 'completed')
),
    updated_at = now()
WHERE cs.id = _session.id;
```

No other RPC signature, return value, or UI change is needed — the schedule page and booking modal already read `current_enrollment` on the next refetch (60s poll + focus refresh), and waitlist notification already runs after cancel.

## Out of scope
- Admin removals (already correct)
- Waitlist backfill flow (unchanged)
- Late-cancellation forfeit rules (unchanged)
- Any UI copy changes
