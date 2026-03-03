

# Detailed Attendance Reports — Implementation Plan

## New Reports to Create

### 1. Member Attendance Overview (`MemberAttendanceOverviewReport.tsx`)
A per-member sortable table showing:
- **Lifetime check-ins** (all-time total from `check_ins`)
- **This month's check-ins** (current month subset)
- **Avg visits/month** (lifetime total ÷ months since `membership_start_date`)
- **Avg visit duration** (computed from `checked_in_at` → `checked_out_at` pairs where both exist)
- **Last visit date** and **Days since last visit**
- Filterable by tier and status, sortable by any column

Data: Two queries — all `check_ins` (no date filter for lifetime), and `members` for names/tier/start date. No schema changes needed.

### 2. Visit Duration Analysis (`VisitDurationReport.tsx`)
- **Avg duration by tier** (horizontal bar chart)
- **Avg duration by day of week** (bar chart, Mon–Sun)
- **Duration distribution** (buckets: <30min, 30–60min, 1–2hrs, 2+ hrs — pie or bar chart)
- Summary cards: overall avg duration, longest avg tier, busiest day

Data: `check_ins` where `checked_out_at IS NOT NULL`, joined with `members` for tier info.

## Existing Reports to Enhance

### 3. Daily Check-ins Report
Add a 4th summary card: **Avg Visit Duration** for the selected date range (from check-ins that have checkout times).

### 4. Visit Frequency Report
Add a **Lifetime** column to the Top 10 Visitors table showing all-time check-in count alongside the period count. Requires one additional query for all-time counts.

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/admin/reports/reports/MemberAttendanceOverviewReport.tsx` | Per-member lifetime stats table |
| `src/components/admin/reports/reports/VisitDurationReport.tsx` | Duration analysis charts |

## Files to Modify
| File | Change |
|------|---------|
| `src/lib/reportDefinitions.ts` | Add 2 new report definitions under `attendance` category |
| `src/components/admin/reports/ReportPreview.tsx` | Import and register the 2 new components |
| `src/components/admin/reports/reports/DailyCheckinsReport.tsx` | Add avg duration summary card |
| `src/components/admin/reports/reports/VisitFrequencyReport.tsx` | Add lifetime column to top visitors |

## No Database Changes Required
All metrics are derived from existing `check_ins` (with `checked_in_at`, `checked_out_at`) and `members` tables.

