# Verify Supabase Configuration - Checklist for Lovable

Use this checklist to verify all necessary parameters have been migrated and configured in Supabase.

## ✅ Database Migrations Status

### Critical Migrations (Must be run):
1. **`20260108000003_scheduled_functions_config.sql`** - Creates configuration table
2. **`20260108000001_configure_scheduled_functions.sql`** - Creates pg_cron jobs
3. **`20260112000000_payment_tracking_system.sql`** - Payment tracking tables
4. **`20260112000001_payment_analytics_functions.sql`** - Payment analytics functions
5. **`20260112000002_check_in_duplicate_prevention.sql`** - Check-in duplicate prevention
6. **`20260112000003_spa_conflict_detection.sql`** - Spa conflict detection

### Recent Migrations (Latest):
- `20260112000002_check_in_duplicate_prevention.sql`
- `20260112000003_spa_conflict_detection.sql`

---

## 🔧 Configuration Parameters to Verify

### 1. Scheduled Functions Configuration Table

**Location:** Supabase Dashboard → SQL Editor

**Check if table exists:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'scheduled_functions_config'
);
```
**Expected:** Should return `true`

**Check if values are set:**
```sql
SELECT 
  id,
  CASE 
    WHEN supabase_url IS NOT NULL AND supabase_url != '' 
    THEN 'Set' 
    ELSE 'NOT SET' 
  END AS url_status,
  CASE 
    WHEN anon_key IS NOT NULL AND anon_key != '' AND anon_key != 'YOUR-ANON-KEY-HERE'
    THEN 'Set (value exists)' 
    ELSE 'NOT SET or placeholder' 
  END AS key_status,
  updated_at
FROM public.scheduled_functions_config
WHERE id = 'default';
```

**Required Values:**
- `supabase_url`: Should be `https://cqzmrdzwgsujgbjqpoxh.supabase.co` (or your actual project URL)
- `anon_key`: Should be your actual anon key from Settings → API (NOT the placeholder `YOUR-ANON-KEY-HERE`)

**If not set, update with:**
```sql
UPDATE public.scheduled_functions_config
SET 
  supabase_url = 'https://cqzmrdzwgsujgbjqpoxh.supabase.co',
  anon_key = 'YOUR-ACTUAL-ANON-KEY-FROM-SETTINGS-API',
  updated_at = now()
WHERE id = 'default';
```

**To get your anon key:**
- Go to Supabase Dashboard → Settings → API
- Copy the `anon` `public` key (NOT the `service_role` key)

---

### 2. Payment Tracking Tables

**Verify tables exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'payment_attempts',
    'subscription_status_history',
    'payment_method_updates',
    'processed_webhook_events'
  )
ORDER BY table_name;
```
**Expected:** Should return 4 rows

---

### 3. Payment Analytics Functions

**Verify functions exist:**
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
**Expected:** Should return 7 rows

---

### 4. Check-In Functions

**Verify function exists:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'check_for_duplicate_check_in';
```
**Expected:** Should return 1 row

---

### 5. Spa Conflict Detection Function

**Verify function exists:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'check_spa_appointment_conflict';
```
**Expected:** Should return 1 row

---

### 6. pg_cron Jobs (Scheduled Functions)

**Verify cron jobs are scheduled:**
```sql
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname IN (
  'process-monthly-credits',
  'process-freeze-expirations',
  'send-class-reminders',
  'process-expired-waitlist',
  'process-activation-reminders'
)
ORDER BY jobname;
```
**Expected:** Should return 5 rows

**Note:** If this query fails, pg_cron extension might not be enabled. Check Supabase Dashboard → Database → Extensions.

---

## 📦 Storage Buckets to Create

These buckets need to be created in Supabase Dashboard → Storage:

1. **`equipment-images`**
   - Public bucket: ✅ Yes
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

2. **`agreements`**
   - Public bucket: ✅ Yes
   - File size limit: 50MB
   - Allowed MIME types: application/pdf

3. **`member-photos`** (may already exist)
   - Public bucket: ✅ Yes
   - For member profile photos

---

## ✅ Quick Verification Checklist

Run this comprehensive check:

```sql
-- Check all critical components
SELECT 
  'scheduled_functions_config table' AS component,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'scheduled_functions_config'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
UNION ALL
SELECT 
  'config values set (not placeholder)',
  CASE WHEN EXISTS (
    SELECT FROM public.scheduled_functions_config 
    WHERE id = 'default' 
    AND supabase_url IS NOT NULL 
    AND anon_key IS NOT NULL 
    AND anon_key != 'YOUR-ANON-KEY-HERE'
  ) THEN '✅ SET' ELSE '❌ NOT SET' END
UNION ALL
SELECT 
  'payment_attempts table',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payment_attempts'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'get_payment_metrics function',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'get_payment_metrics'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'check_for_duplicate_check_in function',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'check_for_duplicate_check_in'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'check_spa_appointment_conflict function',
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'check_spa_appointment_conflict'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'pg_cron jobs scheduled',
  CASE WHEN EXISTS (
    SELECT FROM cron.job 
    WHERE jobname = 'process-monthly-credits'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
```

**Expected:** All should show ✅

---

## 🚨 Critical Action Required

**The `scheduled_functions_config` table MUST have actual values (not placeholders) for:**
- `supabase_url`
- `anon_key`

**If these are still placeholders, the pg_cron jobs will fail!**

---

## 📝 Summary

1. ✅ All migrations should be run
2. ✅ `scheduled_functions_config` table should exist with REAL values
3. ✅ Payment tracking tables should exist
4. ✅ All functions should exist
5. ✅ Storage buckets need to be created manually
6. ✅ pg_cron jobs should be scheduled

**If anything shows ❌, that component needs attention!**
