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

1. **Every number becomes a clickable list.** Clicking "Started this month — 20" scrolls to and opens a section listing exactly those 20 attempts: name, email, date started, and what happened since (Applied Sep 9 / Became member Sep 10 / Still unfinished). Same for "this week" and for the excluded member card updates.

2. **Count people, not attempts.** The summary reads "17 people, 20 attempts this month" so repeat tries by the same person stop inflating the number. Each person's row shows "3 attempts" and expands to the individual dates.

3. **A new "Recent activity" section, open by default.** A single date-ordered list of everyone who started in the chosen window (This week / This month / All), each with an outcome chip — Unfinished, Applied, Member, Test — instead of splitting them across collapsed groups. The follow-up list (unfinished only) stays as the section above it, unchanged.

4. **Outcome dates on every resolved row.** Not just "Already applied" but "Applied Sep 9, 2026" and "Member since Sep 10, 2026", so you can confirm the match yourself rather than trusting the filter.

5. **Empty state explains itself.** When nobody is genuinely unfinished, the page says "20 people started this month — all but 2 have since applied or joined" with a link to the full list, instead of looking broken.

## Technical notes

- `src/hooks/useAbandonedApplications.ts`: keep the current source filter (`application_id is null`, `member_id is null`, `source = 'self_service'`). Add per-person `resolution` (`unfinished` | `applied` | `member` | `test`) plus `resolvedAt` from the matched `membership_applications` / `members` row. Change `last7` / `last30` to count distinct people alongside raw attempts, and return the actual attempt arrays for each window instead of just counts.
- `src/components/admin/AbandonedApplicationsTab.tsx`: summary tiles become buttons that set an active window filter; add the Recent activity table driven by that filter; outcome chips carry the resolved date; `showFiltered` defaults on.
- `src/components/admin/AdminSidebar.tsx`: badge keeps counting only genuinely unfinished people (currently 39 overall, 2 in the last 30 days).
- Read-only: no schema changes, no migrations, no emails sent.
