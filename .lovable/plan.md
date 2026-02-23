

## Fix: Allow Super Admin to Add Any Credit Type as a Gift

### The Problem

When you click "Add" on the Credits tab and select a credit type like Class Credits or Red Light Therapy, if the member doesn't already have an active credit record of that type, the system throws an error: **"No active [type] credits found for this member."**

This is because the code only knows how to create new credit records for Guest Pass credits. For all other types, it tries to find an existing record and fails.

### The Fix

Extend the credit adjustment logic so that when **adding** credits of any type and no existing credit record exists, the system creates a new one -- exactly like it already does for guest passes.

### Technical Details

**File: `src/pages/admin/MemberDetail.tsx`**

The mutation at line ~470 currently has this flow:

```text
1. Look for existing credit of that type
2. If not found AND type is guest_pass --> create new record (works)
3. If not found AND type is anything else --> throw error (broken)
```

The fix changes step 2 to handle ALL credit types when adding:

```text
1. Look for existing credit of that type
2. If not found AND adjustment > 0 (adding) --> create new record for ANY type
3. If not found AND adjustment < 0 (removing) --> throw error (can't remove what doesn't exist)
```

The new credit record will be created with:
- `credits_total` and `credits_remaining` set to the gift amount
- `cycle_start` set to today
- `cycle_end` set to end of current month
- `expires_at` set to end of current month (admin can adjust later if needed)
- Linked to the member via `member_id` and `user_id`

The guest pass email notification will continue to only fire for guest pass credits.

No database or RLS changes are needed -- the existing `member_credits` INSERT policy already allows staff roles.
