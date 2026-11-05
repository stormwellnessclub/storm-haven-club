# Show all usable guest passes at the front desk

## Why front desk can't see them
The front desk Guest Passes page only lists passes **dated for today** (or bought today with no date). Any other pass is hidden, even though admin can see it:
- passes dated for another day, like Brittany Yaffa's (Mon Nov 9)
- passes bought earlier with no date set
- passes for a guest who comes on a different day than planned

## Changes
1. **Three sections on the front desk Guest Passes page:**
   - **Today:** passes dated today, plus undated passes bought today (same as now).
   - **Upcoming:** active, unused passes dated for a later day, soonest first.
   - **Unused, no date / past date:** active passes that haven't been used yet, so a guest who shows up on a different day can still be checked in.
2. **Search box** (name, email, phone) across all three sections.
3. **Checking in from any section** works the same as today. It moves the pass's date to today, using the existing front desk check-in.
4. Used, expired and refunded passes stay hidden, as they are now.

## Technical details
- `src/pages/frontdesk/GuestPassesPage.tsx`: replace the today-only `.or(...)` filter with one query for passes that are either valid today/purchased today, or `status = 'active'` and `used_at is null` (limit 500), then group on the client by `valid_date` using the Detroit date. Add a search input.
- Front desk staff can already read every guest pass (permissions checked), so no database changes are needed.
