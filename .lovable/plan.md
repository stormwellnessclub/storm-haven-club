

## Fix Reports: Accurate Member Counting, Detailed Sales Segmentation, and Projected Revenue

### Problems Identified

1. **Member Status Report** counts ALL members (including cancelled, deactivated, pending) as the headline number. Revenue reports include `pending_activation` members who haven't paid yet.

2. **Revenue by Category Report** only categorizes revenue by guessing from `manual_charges` descriptions. It completely misses:
   - **Cafe orders** (`cafe_orders` table)
   - **Spa appointments** (`spa_appointments` table -- has `service_price`/`member_price`)
   - **Class passes** -- partially covered but not broken down by category (Pilates, Cycling, Aerobics)
   - **Wellness services** -- amenity usage / wellness credits not tracked as revenue
   - **Initiation fees** -- not separated out

3. **No "Next Month Projected Revenue" report** exists. The Cash Flow Projection shows 12 months but doesn't include non-membership revenue sources (cafe, spa, classes) in projections.

---

### Plan

#### 1. Fix Member Counting Across All Reports

**Files:** `RevenueSummaryReport.tsx`, `MemberStatusReport.tsx`, `TierDistributionReport.tsx`

- **Revenue Summary**: Change the query filter from counting all members created in the date range to only counting members with `status IN ('active')` and valid subscriptions (`subscription_status` = `active` or `trialing`) or `billing_type = cash`. Remove `pending_activation` from revenue calculations.
- **Member Status Report**: Keep the pie chart showing all statuses (that's useful), but add a separate "Paying Members" headline stat that only counts `active` members.
- **Tier Distribution**: Already filters by `status = active` for revenue -- will verify and tighten.

#### 2. Create Detailed Sales Segmentation Report

**New file:** `src/components/admin/reports/reports/SalesSegmentationReport.tsx`

This report will query **all revenue sources** directly from their tables:

| Category | Table | Amount Field | Filter |
|----------|-------|-------------|--------|
| Membership Dues | `manual_charges` | `amount / 100` | description contains "membership" or "dues" |
| Initiation Fees | `manual_charges` | `amount / 100` | description contains "initiation" |
| Annual Fees | `manual_charges` | `amount / 100` | description contains "annual" |
| Cafe / Juice Bar | `cafe_orders` | `total_amount` | `status = completed` |
| Spa Services | `spa_appointments` | `member_price` or `service_price` | `status = completed` |
| Class Passes | `class_passes` | `price_paid` | within date range, grouped by `category` (Pilates, Cycling, Aerobics) |
| Guest Passes | `guest_passes` | `price_paid` | `price_paid > 0` (exclude comps) |
| Subscription Payments | `payment_attempts` | `amount / 100` | `status = succeeded` |

The report will show:
- Pie chart of revenue distribution
- Bar chart of revenue by category over time (weekly buckets)
- Detailed table with per-category totals and percentage of overall revenue
- Class pass breakdown sub-table (by Pilates / Cycling / Aerobics)

**Register in:** `ReportPreview.tsx` and `reportDefinitions.ts`

#### 3. Fix Revenue by Category Report

**File:** `RevenueByCategoryReport.tsx`

Update to query actual tables (`cafe_orders`, `spa_appointments`, `class_passes`, `guest_passes`) instead of guessing from `manual_charges` descriptions. Add initiation fee as a separate category.

#### 4. Add Next-Month Projected Revenue Report

**New file:** `src/components/admin/reports/reports/NextMonthProjectionReport.tsx`

This will calculate:
- **Membership dues**: Count active members by tier, multiply by monthly price (exclude founding who paid upfront)
- **Spa projection**: Average daily spa revenue over last 30 days, projected to next month's days
- **Cafe projection**: Average daily cafe revenue over last 30 days, projected forward
- **Class pass projection**: Average weekly class pass sales, projected to 4 weeks
- **Guest pass projection**: Average weekly guest pass sales, projected to 4 weeks

Display as:
- Summary cards (total projected, by category)
- Stacked bar chart showing category contribution
- Assumptions table (showing the averages used)

**Register in:** `ReportPreview.tsx` and `reportDefinitions.ts`

---

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/admin/reports/reports/SalesSegmentationReport.tsx` | Detailed breakdown of all revenue by source |
| `src/components/admin/reports/reports/NextMonthProjectionReport.tsx` | Next-month revenue forecast |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/admin/reports/reports/RevenueSummaryReport.tsx` | Only count active/paying members in revenue |
| `src/components/admin/reports/reports/RevenueByCategoryReport.tsx` | Query actual tables instead of guessing from descriptions |
| `src/components/admin/reports/reports/MemberStatusReport.tsx` | Add "Paying Members" metric separate from total |
| `src/components/admin/reports/ReportPreview.tsx` | Register 2 new report components |
| `src/lib/reportDefinitions.ts` | Add 2 new report definitions |

### No Database Changes Needed
All required tables (`cafe_orders`, `spa_appointments`, `class_passes`, `guest_passes`, `manual_charges`, `payment_attempts`) already exist.

