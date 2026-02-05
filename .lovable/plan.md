
# Comprehensive Admin Payment Infrastructure Audit

## Executive Summary

This audit reveals **critical issues** across the admin payment UI, database tables, edge functions, and webhooks. The most significant problem is that `src/pages/admin/Payments.tsx` uses **hardcoded mock data** with fake names and dates (Dec 2024), while real payment infrastructure exists but is not connected.

---

## Critical Issues Found

### 1. Payments Page Uses Mock Data (CRITICAL)
**Location**: `src/pages/admin/Payments.tsx` (lines 36-91)

**Problem**: The entire transactions table displays hardcoded fake data:
```typescript
const mockPayments = [
  { member: "Sarah Johnson", date: "Dec 25, 2024", amount: 199, ... },
  { member: "Michael Chen", date: "Dec 24, 2024", amount: 199, ... },
  // ... more fake data
];
```

**Impact**: Admins see fictional transactions instead of real Stripe activity.

**Stats are also fake**:
- "Monthly Revenue: $48,250" - hardcoded
- "Active Subscriptions: 1,284" - hardcoded
- Revenue calculations use mock data

---

### 2. PaymentReports Page Uses RPC Functions That Return Empty Data
**Location**: `src/pages/admin/PaymentReports.tsx`

**Problem**: The page calls RPC functions that depend on `payment_attempts` table which has **0 records**:
- `get_payment_metrics` → Returns zeros
- `get_subscription_health` → Returns zeros  
- `get_dunning_efficiency` → Returns zeros

**Root Cause**: The `payment_attempts` table is empty because:
1. Webhook logging via `log_payment_attempt` RPC only triggers on failed payments
2. No subscriptions are active yet (Feb 9th launch pending)
3. Successful payment logging is inconsistent

---

### 3. Missing Real Transaction Data Source
**Problem**: No unified transactions table exists that captures:
- Stripe subscription payments
- One-time charges
- Class pass purchases
- Initiation fee charges
- Refunds

**Current State**:
- `manual_charges` table: Has 5 real records (initiation fees charged by admin)
- `payment_attempts` table: Empty (only tracks dunning/failed payments)
- Stripe is source of truth but not being synced for display

---

### 4. Revenue Analytics Uses Stale Date Filter
**Location**: `src/pages/admin/RevenueAnalytics.tsx` (line 87)

**Problem**: Hardcoded date filter excludes recent data:
```typescript
.lte("created_at", "2025-12-27T15:00:00+00:00")
```
This filters out everything after Dec 27, 2025 as "test data" but that's **before the current date (Feb 5, 2026)**.

---

## Database State Summary

| Table | Records | Purpose | Status |
|-------|---------|---------|--------|
| `payment_attempts` | 0 | Failed payment tracking | Empty - no failures yet |
| `manual_charges` | 5+ | Admin-charged fees | Working |
| `payment_method_updates` | ? | Card change audit trail | Exists |
| `processed_webhook_events` | Many | Webhook idempotency | Working |

---

## What IS Working

1. **Edge Functions**:
   - `stripe-payment` (2760 lines) - Comprehensive payment processing
   - `stripe-webhook` (1536 lines) - Handles all major Stripe events
   - `sync-subscription-status` - Status synchronization

2. **Webhook Event Handling**:
   - `checkout.session.completed` - All checkout types
   - `invoice.payment_succeeded` - Credit renewal, status updates
   - `invoice.payment_failed` - Dunning, email notifications
   - `customer.subscription.*` - Status tracking
   - `payment_method.attached/detached` - Card tracking

3. **RPC Functions** (exist but depend on data):
   - `get_payment_metrics`
   - `get_subscription_health`
   - `get_dunning_efficiency`
   - `get_member_payment_history`
   - `log_payment_attempt`

4. **Admin Components**:
   - `SellMembershipPackage` - Queries real members
   - `SellClassPackage` - Functional
   - `ChargeHistory` - Uses real `manual_charges` table
   - Member detail page - Real charge/refund functionality

---

## Implementation Plan

### Phase 1: Replace Mock Data in Payments.tsx

**Changes Required**:
1. Add query to fetch recent Stripe charges/payments
2. Query `manual_charges` table for admin-initiated charges
3. Aggregate data from `payment_attempts` when available
4. Replace hardcoded stats with real calculations:
   - Revenue Today: Sum of today's successful charges
   - Monthly Revenue: Sum from Stripe invoices this month
   - Active Subscriptions: Count from `members` where `stripe_subscription_id IS NOT NULL`
   - Failed Payments: Count from `payment_attempts` where `status = 'failed'`

### Phase 2: Create Payment Syncing

Create a new function in `stripe-payment` edge function:
- `get_recent_transactions` - Fetch from Stripe API
- Cache in new `stripe_transactions` table or view

### Phase 3: Fix Revenue Analytics Date Filter

Remove or update the hardcoded date filter:
```typescript
// Remove this line:
.lte("created_at", "2025-12-27T15:00:00+00:00")
```

### Phase 4: Enhance Payment Tracking

Modify webhook to log ALL payment attempts (not just failures):
- Log successful subscription payments
- Log one-time charges
- Enable complete payment history view

---

## Technical Implementation Details

### Payments.tsx Rewrite

```text
File: src/pages/admin/Payments.tsx

REMOVE: 
- mockPayments array (lines 36-91)
- totalRevenue calculation using mockPayments (lines 119-121)
- failedCount using mockPayments (line 123)
- filteredPayments using mockPayments (lines 113-117)

ADD:
- useQuery to fetch from manual_charges + payment_attempts
- useQuery for real-time stats from members table
- Optional: Stripe API integration for live transaction data
```

### Stats Cards - Real Data Sources

| Stat | Current Source | Should Be |
|------|---------------|-----------|
| Revenue Today | Hardcoded | `manual_charges` + Stripe API |
| Monthly Revenue | Hardcoded "$48,250" | Stripe API `balance_transactions` |
| Active Subscriptions | Hardcoded "1,284" | `members` table count |
| Failed Payments | mockPayments filter | `payment_attempts` table |

### New Queries Needed

```typescript
// Active subscriptions count
const { count: activeSubscriptions } = await supabase
  .from('members')
  .select('*', { count: 'exact', head: true })
  .not('stripe_subscription_id', 'is', null)
  .eq('status', 'active');

// Today's revenue from manual charges
const { data: todayCharges } = await supabase
  .from('manual_charges')
  .select('amount')
  .gte('created_at', todayStart)
  .eq('status', 'succeeded');
```

---

## Files to Modify

1. **`src/pages/admin/Payments.tsx`** - Complete rewrite to use real data
2. **`src/pages/admin/RevenueAnalytics.tsx`** - Remove stale date filter
3. **`supabase/functions/stripe-webhook/index.ts`** - Add success payment logging
4. **New: `src/hooks/useAdminTransactions.ts`** - Centralized transaction fetching

---

## Database Migrations Needed

### Option A: Use Existing Tables (Minimal Changes)
Leverage `manual_charges` + `payment_attempts` with enhanced queries

### Option B: Create Unified Transactions View (Better Long-term)
```sql
CREATE VIEW admin_transactions AS
SELECT 
  id, 'manual_charge' as source, member_id, amount, description, status, created_at
FROM manual_charges
UNION ALL
SELECT 
  id, 'subscription_payment' as source, member_id, amount, invoice_number as description, status, created_at  
FROM payment_attempts;
```

---

## Summary of Work

| Task | Priority | Effort |
|------|----------|--------|
 | ~~Replace Payments.tsx mock data~~ | ✅ Done | Medium |
 | ~~Add real stats queries~~ | ✅ Done | Low |
 | ~~Fix RevenueAnalytics date filter~~ | ✅ Done | Trivial |
 | ~~Create useAdminTransactions hook~~ | ✅ Done | Medium |
| Add webhook success payment logging | Medium | Medium |
| Create admin_transactions view | Low | Low |

---

## Testing Checklist

After implementation:
 - [x] Payments page shows real `manual_charges` data
 - [x] Stats cards show accurate counts from database
 - [x] Payment Reports page shows real (possibly zero) data
 - [x] Revenue Analytics shows current applications
 - [x] Search/filter works on real transaction data
- [ ] Refund functionality still works from charge history
