

## Fix: Grant Missing Gold Member Credits and Fix Provisioning Bug

### Immediate Fix — Grant Missing Credits

Two Gold members are missing their wellness credits and need them added now:

**Sara Ghamloush** — has zero credits (no auth account linked, so she was skipped entirely)
- Add: 4 Red Light, 2 Dry Cryo, 1 Guest Pass for current cycle

**Amal Hachem** — only has a guest pass, missing wellness credits
- Add: 4 Red Light, 2 Dry Cryo for current cycle

This will be done via an admin-callable endpoint or direct database insert through a migration.

### Root Cause Fix — Update `process-monthly-credits` Edge Function

**File: `supabase/functions/process-monthly-credits/index.ts`**

The monthly credit renewal function has two bugs that prevent credits from being created for certain members:

1. **Member query excludes members without auth accounts** (line ~74): The filter `.not("user_id", "is", null)` skips any member who was imported by admin but hasn't created a login yet. This should be removed — credits should be tied to `member_id`, not `user_id`.

2. **Duplicate check uses `user_id` instead of `member_id`** (line ~130): The existing-credit lookup uses `.eq("user_id", member.user_id)` which fails when `user_id` is null. Change to `.eq("member_id", member.id)` for reliable deduplication.

3. **Credit insert should allow null `user_id`**: When creating credits, use `member.user_id || null` so members without auth accounts still get their credits provisioned against their `member_id`.

### Database: Insert Missing Credits via Migration

A small migration will insert the missing credit records for Sara and Amal:

```sql
-- Sara Ghamloush (member_id: 7e5e3d7c-..., no user_id)
INSERT INTO member_credits (member_id, user_id, credit_type, credits_total, credits_remaining, cycle_start, cycle_end, expires_at)
VALUES 
  ('7e5e3d7c-...', null, 'red_light', 4, 4, '2026-02-09', '2026-03-09', '2026-03-16T05:00:00+00'),
  ('7e5e3d7c-...', null, 'dry_cryo', 2, 2, '2026-02-09', '2026-03-09', '2026-03-16T05:00:00+00'),
  ('7e5e3d7c-...', null, 'guest_pass', 1, 1, '2026-02-14', '2026-02-28', '2026-03-01T04:59:59+00');

-- Amal Hachem (member_id: 750ccfaa-..., user_id: 25d71d58-...)
INSERT INTO member_credits (member_id, user_id, credit_type, credits_total, credits_remaining, cycle_start, cycle_end, expires_at)
VALUES 
  ('750ccfaa-...', '25d71d58-...', 'red_light', 4, 4, '2026-02-09', '2026-03-09', '2026-03-16T05:00:00+00'),
  ('750ccfaa-...', '25d71d58-...', 'dry_cryo', 2, 2, '2026-02-09', '2026-03-09', '2026-03-16T05:00:00+00');
```

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/process-monthly-credits/index.ts` | Remove `user_id` not-null filter, switch duplicate check to `member_id`, allow null `user_id` in inserts |
| Database migration | Insert 5 missing credit records for Sara Ghamloush and Amal Hachem |

### What This Prevents Going Forward

- Members imported by admin (without an auth account) will still receive their monthly credits automatically
- The duplicate check will work reliably for all members regardless of auth status
- No more "phantom missing credits" that require manual intervention

