# Member Retention portal (staff only)

A new admin area, **Retention**, that shows who's coming in, who's slipping away and who needs a personal call. It's built from visits you already record: about 5,000 check-ins since February, plus class, PT, spa and recovery bookings for 122 active members.

## What we're borrowing from the best club software
- **Keepme / Gymmaster / ABC Glofox:** a risk score for each member, based on changes in how often they come in compared with their own normal routine (not one rule for everyone).
- **Mindbody / Zen Planner:** an "at-risk" list you can act on, with the last visit and the reason the member was flagged.
- **Join groups (cohorts), as in ClubReady and analytics tools:** of the members who joined in a given month, the share still visiting at 30, 60 and 90 days.
- **CRM-style outreach logs (HubSpot):** every call, email or text is recorded against the member, so you can see whether it worked.

The full research, with sources, comes first, so the final feature list can be adjusted before building.

## Screens

1. **Overview**
   - Active members, how many visited in the last 7 and 30 days, and the average visits per member each week.
   - Members are grouped as **Thriving / Steady / Slipping / At Risk / Never Started / Gone Quiet (30+ days)**.
   - A trend over the past 12 weeks, with Michigan-time days.
2. **At-risk list** (the main working screen)
   - Each member shows their name, tier, last visit, usual visits per week, visits in the last 2 weeks and a plain reason (for example, "Usually 3×/week, 0 in 14 days" or "Joined 58 days ago, never visited").
   - Filter by tier, group, join date and favorite activity. Sort by risk.
   - Members who are frozen, cancelled or pending are left out of the risk list. Frozen members show on their own tab.
3. **Member detail panel** (side panel, no pop-up windows)
   - A visit timeline across check-ins, classes, PT, spa and recovery.
   - Their favorite activities and usual days and times.
   - Billing status, a log of past outreach, and notes.
   - A suggested personal opener built from their real habits, for example: "We've missed you at Thursday cycling."
4. **Join groups (cohorts)**
   - Members grouped by the month they joined, showing the share still visiting at 30, 60 and 90 days.
5. **Outreach log & results**
   - Log a call, text or email with its outcome: reached, left a message, coming back, wants to cancel.
   - Shows "came back within 14 days" success rates.
   - Texts and emails only go through the existing consent-checked senders. Nothing is sent automatically.

## Rules
- Admin, super admin and manager only. Front desk can't see it.
- Cancelled members are never counted as active.
- Read-only on member, billing and visit records. The only new things saved are outreach logs, notes and a daily snapshot.
- A once-a-day calculation (one scheduled job using the existing secure token) stores each member's score, so the pages load fast.

## Technical details
- `retention_member_daily` table (member_id, date, visits_7/30/90, baseline weekly rate, last_visit_at, segment, risk_score, reasons jsonb), built by the `compute_retention_snapshot()` security-definer function. Visits come from `admin_person_activity()` plus `check_ins`, de-duplicated to one visit per Detroit day.
- `retention_outreach` table (member_id, channel, outcome, note, staff_id, created_at). Grants, RLS through `has_any_role(admin, super_admin, manager)`.
- One daily pg_cron job calls the function directly, with no edge function needed.
- New page `src/pages/admin/Retention.tsx` with tabs, plus a sidebar entry under Membership Management, using master-detail layout.
- Tests cover segment thresholds and the exclusion of cancelled and frozen members.
- An AGENTS.md rule records that retention metrics come only from the daily snapshot function.

## Open choices (defaults used unless you say otherwise)
- "Gone Quiet" = 30+ days without a visit. "Never Started" = no visit within 14 days of joining.
- Risk compares the last 14 days with each member's own average over their prior 60 days.
