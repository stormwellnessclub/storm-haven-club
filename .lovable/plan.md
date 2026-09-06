# Make abandoned applications easy to find

Tracking never stopped. The records are still being collected: 414 card-setup attempts are stored with no completed application attached, the newest from Sept 5, and 35 of those are real people who are neither current members nor existing applicants (most recent: Sept 3). The list is simply buried — it only appears if you open Applications and click the small "Abandoned" button in the row of status filters, and there is no sidebar entry or link that points at it.

## What will change

1. **Sidebar entry** — add "Abandoned Applications" under the Membership Management group so it can be opened in one click (the sidebar today only has "Class Pass Abandoned", which is a different list).
2. **Direct link** — Applications will accept a link that opens straight onto the abandoned view, so the sidebar item and any shortcut land on the right screen instead of the default list.
3. **Count badge** — show the number of people currently waiting in that list next to the sidebar item and on the "Abandoned" filter button, so an empty screen is obviously empty rather than hidden.
4. **Clear empty state** — if there is genuinely nothing to show, the screen will say so, and state how many records were set aside because the person already applied, is already a member, or is a test entry (today those counts sit inside a collapsed area).

No change to how records are captured, no emails sent, and nothing removed from the existing list.

## Technical notes

- `src/pages/admin/Applications.tsx`: read `?tab=abandoned` from the query string to initialise `statusFilter`, and keep the URL in sync when the filter changes.
- `src/components/admin/AdminSidebar.tsx`: new item `/admin/applications?tab=abandoned` in Membership Management with an active-state check on the query param, plus badge count.
- Badge count comes from a small shared query over `card_setup_attempts` (`application_id is null`, grouped by `metadata->>'applicant_email'`, excluding emails found in `membership_applications` / `members` and test-pattern emails) — the same rule `AbandonedApplicationsTab` already applies, extracted so the sidebar and tab agree.
- `AbandonedApplicationsTab`: surface `totals.alreadyApplied` / `alreadyMember` / `testRows` in the empty state.
