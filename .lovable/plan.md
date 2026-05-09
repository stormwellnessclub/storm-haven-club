I found the CSV and confirmed the contacts table already has 2,597 contacts imported under source `mailchimp_roster_2026_05_07`:
- Members: 108
- Non-members: 54
- Prospects: 2,435

The issue is visibility/labeling, not that the list is missing. The Marketing Portal currently only shows the first 500 contacts and the source label does not match the uploaded file name, so it is easy to think the list is gone.

Plan:

1. Update Marketing Portal > Contacts so the uploaded list is obvious
- Add a clear imported-list summary showing the active imported audience/source and total count.
- Show the source label `mailchimp_roster_2026_05_07` as the existing imported audience.
- Make the empty/limited-state copy clearer so staff can tell when contacts exist but are filtered/limited.

2. Fix the “first 500” visibility problem
- Add pagination or a “Load more” control so the full 2,597-contact list can be browsed from the admin UI.
- Keep search and segment filters working across the full table.
- Keep export working for the currently filtered contact list, not just the first 500 displayed rows.

3. Add source/audience filtering
- Add an Audience/Source filter so this Mailchimp/imported roster can be selected directly.
- Display counts by audience/source so the uploaded list is easy to find later.

4. Preserve the existing import flow
- Do not send emails.
- Do not create a bulk email campaign.
- Keep the existing CSV import/preview flow available for future files.
- Do not overwrite existing contacts; duplicates remain skipped by email.

Technical details:
- Update `src/components/admin/marketing/ContactsTab.tsx`.
- Use the existing `marketing_contacts` table and current RLS/admin access.
- Query counts grouped by `source_label`.
- Replace the hard `.limit(500)` list behavior with paginated queries and export behavior that can fetch all filtered rows in batches.