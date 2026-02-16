

## Improve Check-In Page: Full Today's List, Clickable Members, More Detail

### Problems Identified

1. **Only shows 6 recent check-ins** -- the query uses `.limit(6)`, hiding the rest of today's attendees
2. **No click-through to member pages** -- check-in items are plain `div`s with no navigation
3. **Lacks detail** -- only shows name, membership type, and time; missing member ID, photo, status, and notes

### Changes

**File: `src/pages/admin/CheckIn.tsx`**

1. **Remove the `.limit(6)` on `fetchRecentCheckIns`** and fetch ALL of today's check-ins. Also expand the selected fields to include `member_id` (the STM-XXXXXX code), `photo_url`, `status`, and `notes` from the join.

2. **Update the `CheckInRecord` interface** to include the additional member fields (`member_id`, `photo_url`, `status`) and the check-in `notes` field.

3. **Replace the "Recent Check-Ins" card** (currently a small 2-column grid of 6 items) with a full-width scrollable table/list showing ALL today's check-ins:
   - Member photo (avatar with initials fallback)
   - Full name
   - Member ID (STM-XXXXXX)
   - Membership type
   - Status badge
   - Check-in time
   - Notes (if override was used)
   - Each row is clickable and navigates to `/admin/members/{member.id}` (the member detail page)

4. **Make the list section span the full width** instead of `lg:col-span-2` -- move it below the stats card so it gets the full page width for the table.

5. **Add a scroll container** with `max-h-[500px] overflow-y-auto` so the list is scrollable when many members have checked in, and show a count header like "Today's Check-Ins (23)".

6. **Add `useNavigate` from react-router-dom** to enable clicking through to member detail pages.

### Technical Details

- Import `useNavigate` from `react-router-dom`
- Import `Avatar`, `AvatarImage`, `AvatarFallback` from `@/components/ui/avatar` for member photos
- Update `CheckInRecord` to:
  ```typescript
  interface CheckInRecord {
    id: string;
    member_id: string;
    checked_in_at: string;
    notes: string | null;
    members: {
      id: string;
      member_id: string;
      first_name: string;
      last_name: string;
      membership_type: string;
      photo_url: string | null;
      status: string;
    };
  }
  ```
- Remove `.limit(6)` from the fetch query, add `notes` to the select, and expand the `members` join fields
- Render each row as a clickable element with `onClick={() => navigate(`/admin/members/${checkIn.members.id}`)}`  with hover styling and a cursor pointer
- Use a `Table` component for the list with columns: Photo, Name, Member ID, Type, Status, Time, Notes

