

## Fix Admin Reports and Payment Reports Page

### Problems Found

**Problem 1: Most Report Center reports query `membership_applications` instead of `members`**

The following reports all query `membership_applications` (which has 151 rows with statuses like "approved", "pending", "rejected") instead of the actual `members` table (which has 138 rows with real statuses like "active", "pending_activation", "cancelled"):

- **Revenue Summary** -- queries `membership_applications`, shows "approved" members as revenue-generating
- **Member Status Distribution** -- queries `membership_applications`, shows "approved/pending/rejected" instead of real member statuses (active/frozen/cancelled)
- **Tier Distribution** -- queries `membership_applications`, uses hardcoded wrong prices ($695/$495/$395/$295 instead of real pricing from `membershipPricing.ts`)
- **Founding Members** -- queries `membership_applications`, counts all applications including rejected ones as "members"

These reports show inaccurate data because applications are not members. An "approved" application doesn't mean the person is an active, paying member.

**Problem 2: Payment Reports page crashes**

The Payment Reports page (`/admin/payment-reports`) calls three database RPCs:
- `get_payment_metrics` -- returns flat JSON like `{total_attempts: 0, successful_payments: 0, ...}`
- `get_subscription_health` -- returns flat JSON like `{total_members: 0, active_subscriptions: 0, ...}`
- `get_dunning_efficiency` -- returns flat JSON like `{total_failed_first_attempts: 0, ...}`

But the UI expects deeply nested objects like `paymentMetrics.rates.success_rate` and `subscriptionHealth.subscriptions.active`. Since the RPCs return flat structures, accessing nested properties causes "Cannot read property of undefined" crashes.

Additionally, the `payment_attempts` table has 0 rows, so even if the structure matched, everything would show zeros.

**Problem 3: Revenue by Category report doesn't convert cents to dollars**

`RevenueByCategoryReport` reads `manual_charges.amount` (stored in cents) but displays it as dollars without dividing by 100, inflating all numbers by 100x.

---

### Fix Plan

#### 1. Fix Report Center -- Switch from `membership_applications` to `members` table

**Files to update:**

| Report | File | Change |
|--------|------|--------|
| Revenue Summary | `src/components/admin/reports/reports/RevenueSummaryReport.tsx` | Query `members` table with `is_founding_member`, `membership_type`, `status`, `gender` columns |
| Member Status | `src/components/admin/reports/reports/MemberStatusReport.tsx` | Query `members` table; show real statuses (active, frozen, cancelled, pending_activation, past_due) |
| Tier Distribution | `src/components/admin/reports/reports/TierDistributionReport.tsx` | Query `members` table; use `extractTier()` and real pricing from `membershipPricing.ts` instead of hardcoded values |
| Founding Members | `src/components/admin/reports/reports/FoundingMembersReport.tsx` | Query `members` table with `is_founding_member` column (not `founding_member`) |

Key column mapping changes:
- `membership_applications.membership_plan` becomes `members.membership_type`
- `membership_applications.founding_member` becomes `members.is_founding_member`
- Application status "approved" becomes real member status "active"

#### 2. Fix Payment Reports page -- Align UI with RPC response shapes

**File:** `src/pages/admin/PaymentReports.tsx`

The RPCs return flat JSON. Instead of rewriting the RPCs (which would require migrations), transform the flat RPC response into the nested structure the UI expects:

```typescript
// Transform get_payment_metrics flat response
const raw = data; // {total_attempts, successful_payments, failed_payments, ...}
return {
  attempts: { total: raw.total_attempts, successful: raw.successful_payments, ... },
  amounts: { total: 0, successful: raw.total_collected, failed: raw.total_failed_amount },
  rates: { success_rate: raw.success_rate, failure_rate: 100 - raw.success_rate, retry_success_rate: raw.retry_success_rate },
  members_affected: { unique_failed_members: 0 },
};
```

Similar transformations for `get_subscription_health` and `get_dunning_efficiency`.

Also add null-safe checks throughout (e.g., `?.toFixed(1)` instead of `.toFixed(1)`) since with 0 payment_attempts, many values may be null.

#### 3. Fix Revenue by Category -- Convert cents to dollars

**File:** `src/components/admin/reports/reports/RevenueByCategoryReport.tsx`

Divide `manual_charges.amount` by 100 when summing:
```typescript
membershipRevenue += (Number(charge.amount) || 0) / 100;
```

---

### Summary of All File Changes

| File | Issue | Fix |
|------|-------|-----|
| `RevenueSummaryReport.tsx` | Queries applications, not members | Switch to `members` table |
| `MemberStatusReport.tsx` | Queries applications, shows wrong statuses | Switch to `members` table |
| `TierDistributionReport.tsx` | Queries applications, uses wrong hardcoded prices | Switch to `members` table, use `membershipPricing.ts` |
| `FoundingMembersReport.tsx` | Queries applications, counts rejected apps | Switch to `members` table |
| `RevenueByCategoryReport.tsx` | Doesn't convert cents to dollars | Divide amounts by 100 |
| `PaymentReports.tsx` | UI expects nested objects but RPCs return flat JSON; crashes on null access | Transform flat RPC responses to match UI interfaces; add null safety |

No database migrations needed -- all tables and RPCs already exist.

