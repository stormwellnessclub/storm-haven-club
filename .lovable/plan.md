

# Fix: Waitlist Position Always Shows #1 + Counts Not Visible to Members

## Root cause

**RLS (Row Level Security) blocks the queries.** The `class_waitlist` table has a policy: users can only see their own entries. So:

1. **Position bug**: When a new user joins, the query to find the max existing position returns nothing (they have no entries yet) → everyone gets position 1.
2. **Count bug**: `useWaitlistCounts` counts entries the user can see — which is only their own — so regular members always see 0 or 1 waitlisted instead of the real total.

## Fix

### 1. Database function for next position (SECURITY DEFINER)
Create a Postgres function `get_next_waitlist_position(p_session_id uuid)` that runs with elevated privileges (bypasses RLS) and returns the correct next position number. This replaces the broken client-side max-position query.

### 2. Database function for waitlist counts (SECURITY DEFINER)
Create a Postgres function `get_waitlist_counts(p_session_ids uuid[])` that returns session_id + count pairs for active waitlist entries, bypassing RLS so all users see accurate totals.

### 3. Update `useJoinWaitlist` in `useWaitlist.ts`
Replace the manual max-position query with an RPC call to `get_next_waitlist_position`. The insert still happens client-side using the returned position.

### 4. Update `useWaitlistCounts` in `useWaitlist.ts`
Replace the direct table query with an RPC call to `get_waitlist_counts`.

### Files to change
- **New migration**: Two SECURITY DEFINER functions
- **Edit**: `src/hooks/useWaitlist.ts` — use RPC calls instead of direct queries for position and counts

