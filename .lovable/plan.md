## Why the update is failing

The `instructors` table has RLS policies that allow super_admin / admin / manager to do everything, BUT it has **zero table-level GRANTs** for `authenticated`. SELECT was intentionally revoked (contact info is hidden — staff read through the `get_instructors_with_contact` RPC), and INSERT/UPDATE/DELETE were never granted back to `authenticated` either. PostgREST needs both the grant *and* an RLS pass, so every insert/update from the admin dialog is rejected before RLS even runs.

## Fix

Migration that grants only the write privileges to `authenticated` (SELECT stays revoked so contact fields remain protected):

```sql
GRANT INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
```

RLS still restricts these operations to super_admin / admin / manager via the existing "Staff can manage instructors" policy — no policy changes needed. After this, editing/adding placeholder instructors from `/admin/instructors` will work.

## Will instructors get an email when added?

**No.** I checked:

- No database trigger on `public.instructors` (only the `updated_at` timestamp trigger).
- No edge function sends anything to instructor addresses on insert/update.
- No email template targets instructors — the instructor "schedule email" system you're referencing is not wired up. Adding them here just stores their profile; nothing goes to their inbox.

The only places their name/email is used today are:
- Class reminder emails to **members** (their name is shown as "Instructor: X").
- Roster/day-view for staff.

So it's safe to add all your instructors now. When you're ready to turn on instructor-facing schedule emails, that'll be a separate build we can review together first.

Approve and I'll ship the grant.