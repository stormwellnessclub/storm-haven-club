

## Problems Identified

### 1. Non-member profiles don't capture first/last name on auto-creation
When a non-member profile is auto-created in `useNonMemberProfile.ts` (line 43-51), it only inserts `user_id` and `email`. It does **not** copy `first_name` and `last_name` from the `profiles` table, even though signup captures those fields.

**Evidence**: All three Nada non_member_profiles have `first_name: null, last_name: null`, while the corresponding `profiles` rows have the correct names.

### 2. Can't access certain non-member accounts in admin
If a user doesn't have a `non_member_profiles` row, they won't appear in the Non-Member Accounts list or be clickable in the directory. The `NonMemberDetail` page uses `.single()` on the query, so it throws an error if no row exists.

---

## Plan

### A. Fix auto-creation to copy name from profiles (`src/hooks/useNonMemberProfile.ts`)
When auto-creating a non_member_profile, first fetch the user's `profiles` row and copy `first_name`, `last_name`, and `phone` into the new non_member_profiles row.

```typescript
// Before inserting, fetch from profiles table
const { data: existingProfile } = await supabase
  .from("profiles")
  .select("first_name, last_name, phone, email")
  .eq("user_id", user.id)
  .maybeSingle();

const { data: newProfile, error: insertError } = await supabase
  .from("non_member_profiles")
  .insert({
    user_id: user.id,
    email: user.email || null,
    first_name: existingProfile?.first_name || null,
    last_name: existingProfile?.last_name || null,
    phone: existingProfile?.phone || null,
  })
  .select()
  .single();
```

### B. Backfill existing non_member_profiles with missing names (SQL migration)
Update all existing `non_member_profiles` rows that have null names by copying from the `profiles` table:

```sql
UPDATE non_member_profiles nmp
SET first_name = COALESCE(nmp.first_name, p.first_name),
    last_name = COALESCE(nmp.last_name, p.last_name),
    phone = COALESCE(nmp.phone, p.phone),
    updated_at = now()
FROM profiles p
WHERE p.user_id = nmp.user_id
  AND (nmp.first_name IS NULL OR nmp.last_name IS NULL OR nmp.phone IS NULL);
```

### C. Add a database trigger for future-proofing
Create a trigger on `non_member_profiles` INSERT that automatically copies name/phone from `profiles` if missing — so even edge cases are covered.

### Files to change
- `src/hooks/useNonMemberProfile.ts` — update auto-create to fetch and copy profile data
- New SQL migration — backfill existing rows + add trigger

