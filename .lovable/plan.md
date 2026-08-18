# Bring back the missing rows in the Abandoned tab

## What actually happened

Nothing was deleted. The rewrite of the tab started hiding rows, and the Stripe repair moved rows between groups. Checked against the live data right now:

- 420 card-setup rows total; 390 have no application linked.
- 242 of those 390 have **no applicant email saved on the attempt** — the tab skips any row without an email, so they never render at all. This is the single biggest chunk of "missing" people.
- 148 rows have an email, but the tab now collapses them to **108 unique people** (one row per email, newest kept).
- Of those 108 it then hides: 72 who already have an application on file, 63 who are already members, 1 test email.
- What's left is what you see: **17 "Card saved, never submitted" + 17 "Never entered a card" = 34 rows.**

So the shrink is three filters stacked on top of each other (dedupe by email, hide anyone already an applicant/member, hide test emails) plus the silent drop of every attempt with no email captured.

## What to change

### 1. Stop silently dropping rows

Add a fourth group: **Incomplete record** — attempts with no email captured, shown with date, Stripe customer id, card brand/last4 and status, so staff can still look them up in Stripe. Pull the applicant name/email from the linked Stripe customer where the metadata is blank, so most of these get a real identity back.

### 2. Show the filter math instead of hiding it

Header line above the groups: total attempts, how many were merged as repeat attempts by the same person, how many were hidden as already-applied / already-a-member, how many are test rows. Each of those counts is a toggle that reveals the hidden rows in place, so nothing is unverifiable.

### 3. Make "already on file" a badge, not a delete

Rows matching an existing application or member stay in the list behind the toggle, marked "Already applied" / "Already a member" with a link to that record, instead of disappearing.

### 4. Keep repeat attempts visible

Deduping by email stays the default, but each row shows "3 attempts" when a person tried multiple times, expandable to the individual dates.

### 5. Export follows what's on screen

CSV export includes whichever groups/toggles are currently shown, plus a column for why a row was filtered.

## Technical notes

- All changes are in `src/components/admin/AbandonedApplicationsTab.tsx` — the query keeps fetching the same `card_setup_attempts` rows but returns full group buckets with a reason tag per row instead of dropping them.
- Backfilling names/emails for the 242 metadata-less rows uses the existing `reconcile-card-setup-attempts` function: extend it to also read `customer.name` / `customer.email` from Stripe and write them into `metadata` when missing. Run once, then it stays covered by the nightly job.
- No schema changes, no emails, no outreach.
