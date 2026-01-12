# Instructions for Lovable: Run Payment Management System Migrations

## Task
Run two Supabase migrations to activate the payment tracking and analytics system.

## Steps

### Step 1: Open Supabase SQL Editor
1. Go to Supabase Dashboard
2. Navigate to your project
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run First Migration
1. Open the file: `supabase/migrations/20260112000000_payment_tracking_system.sql`
2. Copy the **ENTIRE** contents of the file
3. Paste into the SQL Editor
4. Click **Run** or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
5. Wait for "Success" confirmation

### Step 3: Run Second Migration
1. Open the file: `supabase/migrations/20260112000001_payment_analytics_functions.sql`
2. Copy the **ENTIRE** contents of the file
3. Paste into the SQL Editor
4. Click **Run** or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
5. Wait for "Success" confirmation

### Step 4: Verify Tables Were Created
Run this SQL query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('payment_attempts', 'subscription_status_history', 'payment_method_updates')
ORDER BY table_name;
```

**Expected Result:** Should return 3 rows (one for each table)

### Step 5: Verify Functions Were Created
Run this SQL query to verify:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'log_payment_attempt',
    'update_subscription_status_with_history',
    'track_payment_method_update',
    'get_payment_metrics',
    'get_subscription_health',
    'get_dunning_efficiency',
    'get_member_payment_history'
  )
ORDER BY routine_name;
```

**Expected Result:** Should return 7 rows (one for each function)

## What This Does

These migrations create:
- **3 new tables** for payment tracking
- **7 new functions** for payment analytics and tracking
- **Complete payment lifecycle tracking** from webhook events
- **Subscription status audit trail**
- **Payment method expiration tracking**

## Important Notes

- ✅ These migrations are **safe** - they use `IF NOT EXISTS` and won't break existing data
- ✅ No data will be lost or modified
- ✅ The system will start tracking new payment events immediately after migrations
- ✅ Historical data will populate as new Stripe webhook events are received

## After Migrations Complete

The following features will be active:
- Admin Payment Reports page (`/admin/payment-reports`) - will show real data
- Member Payment History page (`/member/payment-history`) - will show real data
- Enhanced webhook handler - will track all payment attempts
- Subscription reconciliation - sync function will work properly

---

**Once both migrations show "Success", the payment management system is fully operational.**
