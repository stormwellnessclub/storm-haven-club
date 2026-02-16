

## Fix: Admin Cannot Deduct Red Light Session for Gold Member

### Root Cause

The admin "Book Session" dialog on the Member Detail page **inserts into `spa_appointments` with `user_id: member.user_id`**, but:

1. **Some gold members have `user_id = null`** (Sara Ghamloush, Tania Shatila) because they haven't created an auth account yet. The insert sends `user_id: null`, which technically succeeds but makes the appointment untraceable to the member.

2. **The insert does NOT set `member_id`** on the `spa_appointments` row -- it only sets `user_id`. This means even for members WITH a user_id, the appointment isn't linked via the member record. This also means the `log_spa_service` trigger (which checks `member_id IS NOT NULL` to log activity) won't fire.

3. **If the admin was using the member-facing Wellness page** (not the Member Detail page), the "Book Session" button uses `useAuth()` -- which returns the admin's own account. Since the admin isn't a gold member, they'd see "No credits available."

### Fix

**File: `src/pages/admin/MemberDetail.tsx`** (lines ~2106-2112)

Update the `spa_appointments` insert in the admin booking dialog to:
- Always include `member_id: member.id` (the member's UUID, always available)
- Use `member.user_id || null` for `user_id` (gracefully handle null)
- Add a `booked_by` note indicating admin booked it

This ensures the appointment is always linked to the member record and the activity trigger fires correctly.

### Technical Details

Change the insert from:
```typescript
await supabase.from("spa_appointments").insert({
  user_id: member.user_id,
  service_id: ...,
  ...
});
```

To:
```typescript
await supabase.from("spa_appointments").insert({
  user_id: member.user_id || null,
  member_id: member.id,  // Always set member_id
  service_id: ...,
  ...
  notes: `Booked by staff`,
});
```

This is a small, targeted fix -- one line addition (`member_id`) and a null safety check on `user_id`.

