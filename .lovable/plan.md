

## Two Root Causes Found — Class Passes & Admin Booking

### What's Actually Happening

After inspecting the database and code, there are two distinct bugs causing the problems you're seeing.

---

### Bug 1: Class Passes Are Invisible in the Admin Panel

The admin panel queries class passes using `.eq("member_id", id)` (the member's internal database ID). But when class passes were imported, they were linked by `user_id` only — the `member_id` column on all 5 recently-added passes is `NULL`.

This means the admin Credits tab shows zero class passes for those members, even though the passes exist in the database and work on the member-facing booking page.

**Fix:** Run a one-time database migration to backfill `member_id` on all `class_passes` rows where it is currently NULL, by matching through the `members` table on `user_id`. Then update the admin query to also fall back to fetching by `user_id` as a safety net going forward.

---

### Bug 2: "Book Session" Button is Disabled for Members Who Only Have Class Passes (Not Class Credits)

The "Book Session" dialog was built to use `member_credits` (the recurring credits like Diamond members get). But several members bought class passes (10-packs), which are stored in `class_passes` — not `member_credits`. The "Book with Credit" button is disabled when no `class`-type credit record exists, even if the member has an active class pass with uses remaining.

The dialog needs to also offer booking via a class pass, not just class credits.

**Fix:** Extend the "Book Session" dialog to:
1. Show class passes available for the member (fetched via `user_id` as the corrected query)
2. Allow the admin to select either "Use class credit" or "Use class pass" when booking a class
3. Pass the correct `_pass_id` to the `create_atomic_class_booking` RPC when a pass is selected

---

### Technical Details

**Migration (runs first):**
```sql
-- Backfill member_id on class_passes where it is NULL
UPDATE class_passes cp
SET member_id = m.id
FROM members m
WHERE cp.user_id = m.user_id
  AND cp.member_id IS NULL;
```

**Admin query fix** — change the class passes fetch from `.eq("member_id", id)` to use the member's `user_id`:
```ts
// src/pages/admin/MemberDetail.tsx line ~318
.eq("user_id", member.user_id)  // was: .eq("member_id", id)
```

**Dialog extension** — add a "Pay with Pass" option in the class booking flow:
- New state: `adminBookPaymentMethod: "credit" | "pass"` and `adminBookPassId: string`
- When service type is "class": show both credits (if any) and passes (if any) as payment options
- Call RPC with `_pass_id` when pass is selected, `_member_credit_id` when credit is selected

---

### Files to Modify

| File | Change |
|------|--------|
| Database migration | Backfill `member_id` on all `class_passes` rows that have NULL |
| `src/pages/admin/MemberDetail.tsx` | Fix class passes query to use `user_id`; extend Book Session dialog to support paying with a class pass |

### Order of Execution
1. Run the migration to backfill `member_id` (fixes visibility immediately)
2. Update the admin query to use corrected fetch logic
3. Extend the "Book Session" dialog with pass-based booking

