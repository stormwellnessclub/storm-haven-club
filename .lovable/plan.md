## What the data actually shows

I queried `check_ins` to verify before building anything. Counting **unique days visited** (not raw check-ins) per member for April 2026:

- 93 active members visited at least once in April
- Average: **7.4 days/month** (median 6)
- Top visitors: Wafa Beydoun 24, Summer Daoud 21, Batoul Ismail 20, Souad Jomaa 19, Dalal Elali 18, Rayanne Haidar 18, Lauren Anderson 16, Aya Charafeddine 16, Dunia Mashhour 16, Fatima Naji 16, Layal Zreik 16, Shams Al-Badry 15, Victoria Fletcher 15
- 13 members visited 15+ days, 3 visited 20+ days

So the 7.5/month average from the market report is correct — but it's pulled down by the long tail of light users. The "everyday" members you see are the top ~15% of the base. Both views matter, and the prior report only showed the average.

## Plan

Generate a new report **`Storm_Wellness_Member_Visit_Frequency.xlsx`** + matching PDF that breaks down visits properly:

### Tab 1 — Per Member Detail
For each active member (last 90 days):
- Name, tier, status
- Days visited (Apr), Days visited (Mar), Days visited (Feb)
- Total check-ins (raw, including same-day duplicates)
- Avg days/month over period
- Last visit date
- Engagement bucket (see below)

Sorted by avg days/month descending. Top users surface first.

### Tab 2 — Engagement Distribution
Bucketed counts so the "they come every day" reality is visible:
- Power users (20+ days/mo)
- Heavy (15–19)
- Regular (8–14)
- Light (3–7)
- Occasional (1–2)
- Inactive (0)

Each bucket shows: member count, % of base, avg days, total visits.

### Tab 3 — Monthly Trend
By month (Feb / Mar / Apr 2026): unique active members, total visit-days, avg days/member, top-10 visit count.

### Tab 4 — Summary
Headline numbers correctly framed:
- Avg days/month (whole base): 7.4
- Avg days/month (active only): same recalc
- Median: 6
- Top quartile avg: ~16+
- % of base visiting 15+ days: ~14%

### PDF
1-page executive summary mirroring Tab 4 + top-20 list + bucket chart.

### Methodology note (in both files)
- "Visits" = distinct calendar days a member checked in (Chicago time), not raw check-in rows
- Same-day multiple swipes count once
- Active = members who visited at least once in the month
- Source: `check_ins` table

Files written to `/mnt/documents/`. After creation I'll convert each PDF page to image and visually QA before delivering.
