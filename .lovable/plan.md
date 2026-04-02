
## What I found

Yes — this explains why staff still cannot book those credits either.

### Root cause 1: the wellness booking RPC is writing to the wrong spa appointment columns
The function `book_wellness_appointment` inserts into:

- `credit_id`
- `credit_type`
- `notes`

But the current `spa_appointments` schema and generated types only include:

- `member_notes`
- no `credit_id`
- no `credit_type`

So the booking path is out of sync with the actual table shape. That would break member credit bookings in the RPC path.

### Root cause 2: the member RPC only allows `active` members
`book_wellness_appointment` looks up the member with:

```sql
WHERE user_id = auth.uid() AND status = 'active'
```

But elsewhere in the app, frozen members are treated as still able to use existing wellness credits. So some users can see credits but the backend rejects them.

### Root cause 3: the staff booking path is not atomic
In `MemberDetail.tsx`, staff booking does this in two separate steps:

1. decrement `member_credits`
2. insert `spa_appointments`

If the appointment insert fails, the credit is already removed. That matches exactly what you described: staff has to keep manually fixing credits.

### Root cause 4: staff insert likely also fails because it uses missing fields
The staff booking insert also sends:

- `credit_id`
- `credit_type`

Those fields are not present in the current typed `spa_appointments` table definition, so this path is also inconsistent with the current schema.

## Plan

### 1. Repair the wellness booking data model
Create a migration to bring `spa_appointments` in line with how the app already uses it.

Recommended approach:
- add `credit_id uuid references member_credits(id) on delete set null`
- add `credit_type credit_type`
- keep `member_notes` as the member-facing note field
- do not use a generic `notes` column for appointments

This preserves the credit audit trail already assumed by the app.

### 2. Fix the RPC to match the real schema
Update `book_wellness_appointment` so it:
- inserts into `member_notes` instead of `notes`
- writes `credit_id` and `credit_type` into the now-supported columns
- allows eligible statuses consistently (`active`, and `frozen` if that remains the intended rule)
- stays atomic so credits are only deducted if the appointment is actually created

### 3. Fix staff booking to use one atomic backend path
Refactor the admin wellness booking flow in `MemberDetail.tsx` so staff do not:
- manually decrement credits first
- then separately insert the appointment

Instead, use one database function for staff wellness bookings that:
- validates the selected credit
- locks the row
- creates the appointment
- deducts exactly one credit
- rolls back everything if any step fails

This is the key fix for the “we still have to keep manually removing/fixing them” issue.

### 4. Unify credit eligibility rules
Align these sources so they all agree:
- `useUserCredits`
- `useWellnessCredits`
- `SpaBookingModal`
- wellness booking RPC / staff RPC

That way the app does not show credits as usable while the backend rejects them.

### 5. Verify both booking paths
After implementation, test these cases:
- member books Red Light with credit
- member books Dry Cryo with credit
- staff books Red Light for a member
- staff books Dry Cryo for a member
- failed booking does not deduct a credit
- successful booking deducts exactly one credit
- appointment record stores `credit_id` and `credit_type`

## Files to update

- `supabase/migrations/...` — add missing `spa_appointments` credit columns and replace/fix wellness booking function(s)
- `src/pages/admin/MemberDetail.tsx` — switch staff booking to atomic RPC flow
- `src/hooks/useWellnessCredits.ts` — align credit lookup rules
- `src/hooks/useUserCredits.ts` — keep logic consistent with backend
- optionally `src/components/booking/SpaBookingModal.tsx` — if any frontend messaging/assumptions need to be aligned

## Expected result

After this fix:
- members with Red Light and Dry Cryo credits should be able to book normally
- staff should also be able to book those sessions for members
- credits should no longer disappear on failed booking attempts
- staff should no longer need to manually repair balances
