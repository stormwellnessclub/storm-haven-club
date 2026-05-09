## Plan: Purge overlap + improve segment visibility

**1. Hard-purge 162 overlapping rows from `marketing_contacts`**
- Delete rows where `segment IN ('member','non_member')` AND `source_label = 'mailchimp_roster_2026_05_07'`.
- Result: marketing list becomes prospects-only (~2,435 rows from this import).
- Run via insert/migration tool with explicit count check before/after.

**2. Improve segment visibility in Contacts tab UI** (`src/components/admin/marketing/ContactsTab.tsx`)
- Replace the plain segment dropdown with prominent clickable segment "pills" at the top of the list — each shows count and is colored:
  - All • Prospects (green) • Members (blue) • Non-members (amber) • Unsubscribed
- Add a clear banner/note above the table: "This list is prospects-only — members and non-members are tracked in their own systems and excluded from marketing imports."
- Show active filter chips (segment + source + search) with one-click clear.
- Keep existing search, source filter, pagination, and export behavior unchanged.

**3. Also export a one-time CSV of the 162 purged rows to `/mnt/documents/`** before deletion as a backup, in case you want to re-add any.

No business-logic / RPC changes. No email sending. Just cleanup + UI clarity.
