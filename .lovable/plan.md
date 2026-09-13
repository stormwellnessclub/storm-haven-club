# Make "started this month" show the actual people

## What's wrong

The numbers at the top and the list below count two different things, so the page contradicts itself.

Checked against live data right now (last 30 days, application-form card attempts only):

- **20 attempts in the last 30 days, 3 in the last 7** — these are the numbers on screen.
- Those 20 attempts are **17 different people** (Rand Makled, Oshana Mandell x3, Jennah Ayache and Aferdita Hodzic each tried more than once).
- Of the 17: **13 already have an application on file**, **11 of those also became members**, and only **2 are genuinely unfinished** — Ray Haidar (Aug 21) and Sidra Sinan (Sep 3).
- All 3 of this week's attempts (Rasha Beydoun Sep 11, Kay Price and Aferdita Hodzic Sep 9) went on to submit an application, and two are already members.

So the count is honest about attempts, but everyone it counts has already been resolved and moved out of the visible list — and the section that would show them ("Finished later — not leads") is collapsed by default. Nothing on screen lets you click 20 and see who those 20 are.

## What changes

1. **The follow-up list stays pure.** Only genuinely unfinished people appear in it — anyone who has since applied or become a member is never mixed in, never selectable for a reminder, and never counted in the badge. Today that list is 2 people in the last 30 days (Ray Haidar, Sidra Sinan) and 39 overall.

2. **People who applied get their own separate section, clearly labelled.** "Started, then applied" and "Started, then joined as a member" sit below the follow-up list as distinct read-only sections with their own headings and counts — visible so the math adds up, but plainly not leads and with no reminder checkboxes.

3. **Every number becomes a clickable list.** Clicking "Started this month — 20" opens the matching section so you can see exactly who those 20 are: name, email, date started, and outcome with its date (Applied Sep 9 / Member Sep 10 / Still unfinished).

4. **Count people, not attempts.** The summary reads "17 people, 20 attempts this month" so repeat tries by the same person stop inflating the number. Each person's row shows "3 attempts" and expands to the individual dates.

5. **Empty state explains itself.** When nobody is genuinely unfinished, the page says "20 people started this month — all but 2 have since applied or joined" with a link to those sections, instead of looking broken.


## Technical notes

- `src/hooks/useAbandonedApplications.ts`: keep the current source filter (`application_id is null`, `member_id is null`, `source = 'self_service'`). Add per-person `resolution` (`unfinished` | `applied` | `member` | `test`) plus `resolvedAt` from the matched `membership_applications` / `members` row. Change `last7` / `last30` to count distinct people alongside raw attempts, and return the actual attempt arrays for each window instead of just counts.
- `src/components/admin/AbandonedApplicationsTab.tsx`: summary tiles become buttons that set an active window filter; add the Recent activity table driven by that filter; outcome chips carry the resolved date; `showFiltered` defaults on.
- `src/components/admin/AdminSidebar.tsx`: badge keeps counting only genuinely unfinished people (currently 39 overall, 2 in the last 30 days).
- Read-only: no schema changes, no migrations, no emails sent.
