

# New Reports: Member Engagement, Guest Returns, Class Engagement

## What's Missing

The existing engagement reports are basic — Workout Activity just counts logged workouts, Goals Progress tracks goal completion, and Credit Balances shows credit standings. There's no holistic **member engagement score** report, no **guest return tracking** (repeat visitors by email), and no **class engagement** report showing member participation patterns over time.

## New Reports to Create

### 1. Member Engagement Report (`MemberEngagementReport.tsx`)
A comprehensive engagement dashboard showing how active members really are across all touchpoints.

- **Summary cards**: Total active members, Avg engagement score, High/Medium/Low engagement breakdown
- **Data source**: Query `members` (active), then for each calculate a simple engagement score from `check_ins` (last 30d), `workout_logs` (last 30d), `class_bookings` (last 30d), `spa_appointments` (last 30d), `cafe_orders` (last 30d)
- **Engagement tiers**: High (5+ touchpoints/month), Medium (2-4), Low (0-1), Inactive (0 in 60+ days)
- **Pie chart**: Engagement tier distribution
- **Bar chart**: Engagement by membership tier
- **Table**: Bottom 15 least-engaged active members (churn risk)
- Register as `member-engagement` in the `engagement` category

### 2. Guest Returns Report (`GuestReturnsReport.tsx`)
Track repeat guests by matching `guest_email` across multiple `guest_passes` records.

- **Summary cards**: Total unique guests, Repeat guests (2+ passes), Return rate %, Total repeat revenue
- **Logic**: Group `guest_passes` by `guest_email`, count passes per unique email, identify those with 2+ entries as "returning"
- **Bar chart**: Distribution of visit count (1 visit, 2 visits, 3+ visits)
- **Table**: Top returning guests with visit count, total spend, last visit date, and whether they converted to member (check if email exists in `members` table)
- Register as `guest-returns` in the `services` category

### 3. Class Engagement Report (`ClassEngagementReport.tsx`)
Member-centric view of class participation patterns (vs the existing ClassAttendance which is class-centric).

- **Summary cards**: Members taking classes, Avg classes/member, Most popular class, Member-to-class ratio
- **Data source**: Query `class_bookings` joined with `class_sessions` and `class_types`, group by user
- **Bar chart**: Classes booked per member (distribution — 1-2, 3-5, 6-10, 10+ classes)
- **Line chart**: Weekly class participation trend (unique members attending)
- **Table**: Top 15 most active class participants with class count, favorite class type, attendance rate
- Register as `class-engagement` in the `classes` category

## Files to Create
- `src/components/admin/reports/reports/MemberEngagementReport.tsx`
- `src/components/admin/reports/reports/GuestReturnsReport.tsx`
- `src/components/admin/reports/reports/ClassEngagementReport.tsx`

## Files to Modify
- `src/lib/reportDefinitions.ts` — add 3 new report entries
- `src/components/admin/reports/ReportPreview.tsx` — import and register 3 new components

## No database changes needed.

