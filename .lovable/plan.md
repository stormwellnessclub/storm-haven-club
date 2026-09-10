# Fix unfinished applications so it only shows real applicants

## What's actually wrong

The list pulls every saved-card attempt in the system, not just attempts from the application form. Checked against live data right now:

- 418 card attempts with no application attached.
- **251 of them are existing members** saving or updating a card in the member portal or through staff at the front desk. These have a member record attached directly and were never applicants.
- 164 come from the public application form. Of those, 110 belong to people who are already members and 127 to people who already have an application on file (overlapping).
- Once members and existing applicants are removed, **39 people are genuinely unfinished** — that is the real follow-up list.

Two separate causes:

1. Member card updates were never excluded at the source. The list only skipped attempts linked to an application, so every member portal card save flowed in as a "lead".
2. The date rule added recently ("only counts as finished if the record came after the attempt") was applied to member records too. A member who saves a card today has a member record from months ago, so the rule stopped recognising them.

## What changes

1. **Only application-form attempts feed the list.** Attempts tied to a member record, or coming from the member portal / admin portal / front desk, are excluded entirely — they are card maintenance, not applications. They will never appear, never count in the red badge, and can never be selected for a "finish your application" reminder.
2. **Anyone with a member record is never a lead**, no matter when they became a member. The date rule stays only for applications, where it correctly separates "started again after already applying" from "finished later".
3. **The email reminder gets a second safety check** at send time: if a recipient has become a member or completed an application since the page loaded, they are skipped and reported as skipped, so no member can be emailed a reminder by accident.
4. **The counts on the page tell the whole story** — total attempts recorded, how many were member card updates (excluded), how many finished later, and how many are genuinely unfinished. Member card updates get their own collapsed "Card updates by existing members" count so nothing is invisible, but they sit outside the lead list.
5. **The red sidebar badge counts only the genuinely unfinished** — currently 39 — with the tooltip showing what was excluded.

## Technical notes

- `src/hooks/useAbandonedApplications.ts`: query filters to `application_id is null AND member_id is null AND source = 'self_service'`; a separate lightweight count query returns the excluded member-card-update total for display. Member email matching goes back to date-insensitive (`memberEmails.has(email)`); `resolvedAfter` stays for applications only. Result gains `memberCardUpdates` count.
- `src/components/admin/AbandonedApplicationsTab.tsx`: summary bar shows the excluded member-card-update count; `handleBulkSend` re-checks each recipient against members/applications immediately before invoking `send-application-reminder` and reports skips.
- `src/components/admin/AdminSidebar.tsx`: tooltip wording updated to include excluded member card updates.
- Read-only: no schema changes, no migrations, no emails sent as part of this work.
