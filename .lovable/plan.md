

## Fix: Roster Showing "Unknown" and Missing Bookings

### Problem

The Class Roster query only joins the `members` table for names. When someone books a class via a class pass (non-member / portal user), they may not have a `members` record, so:
- Their name shows as "Unknown"
- If they also have no `walk_in_name`, the row appears blank

This explains both issues:
- **Feb 27**: 1 enrolled but roster appears empty (the booking exists but the name resolver returns nothing useful)
- **Feb 28 at 9 PM**: 2 enrolled but one shows as "Unknown" (one has a member record, the other doesn't)

### Fix

After fetching bookings, do a secondary lookup of `profiles` by `user_id` for any booking where `members` is null. Use the profile's `first_name` / `last_name` as fallback.

### Changes

| File | Change |
|------|--------|
| `src/components/admin/ClassRosterDialog.tsx` | After the bookings query, fetch `profiles` for any booking where `members` is null. Enrich the booking data with profile info. Update `getDisplayName` and `getInitials` to use the profile fallback before falling through to "Unknown". |

### Technical Detail

The bookings query currently does:
```
select("id, user_id, member_id, status, ..., members (id, first_name, last_name, photo_url)")
```

After this query returns, we collect `user_id` values from bookings where `members` is null, then:
```typescript
const { data: profiles } = await supabase
  .from("profiles")
  .select("user_id, first_name, last_name")
  .in("user_id", missingUserIds);
```

Then merge that into each booking as a `profile` fallback field. The display logic becomes:
1. Use `members.first_name + last_name` if available
2. Else use `profile.first_name + last_name` if available
3. Else use `walk_in_name`
4. Else "Unknown"

No database changes needed.

