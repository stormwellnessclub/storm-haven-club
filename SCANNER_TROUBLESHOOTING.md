# Member Scanner Troubleshooting Guide

## Issue: Member Scanner Not Working

### Quick Fix

**Run this migration in Supabase SQL Editor:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of: `supabase/migrations/20260113000000_fix_scanner_photo_url.sql`
3. Click "Run"
4. Verify success message

### Common Issues & Solutions

#### 1. "Function does not exist" Error

**Symptom:** Error code `42883` or "function process_member_scan does not exist"

**Solution:**
Run all scanner-related migrations:
- `supabase/migrations/20260107000000_scanner_system.sql`
- `supabase/migrations/20260112000002_check_in_duplicate_prevention.sql`
- `supabase/migrations/20260113000000_fix_scanner_photo_url.sql` (NEW)

#### 2. "Permission denied" Error

**Symptom:** Error about permissions or RLS policies

**Solution:**
```sql
-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_member_scan TO authenticated;

-- Verify RLS policies exist
SELECT * FROM pg_policies WHERE tablename = 'scanner_access_logs';
```

#### 3. "Member ID not found" Error

**Symptom:** Scanner says member not found even though member exists

**Solution:**
- Verify member_id format: Should be like `STM-000001` (not UUID)
- Check database:
```sql
SELECT member_id, first_name, last_name, status 
FROM members 
WHERE member_id = 'STM-000001';
```

#### 4. Scanner Works But No Photo Shows

**Symptom:** Scanner works but member photo doesn't display

**Solution:**
- This was fixed in the new migration (photo_url now included)
- Run: `supabase/migrations/20260113000000_fix_scanner_photo_url.sql`

#### 5. Scanner Doesn't Check In Members

**Symptom:** Access granted but no check-in created

**Solution:**
- Check if "Auto Check-In" toggle is enabled
- Verify check_ins table exists and has proper permissions
- Check browser console for errors

### Testing Steps

1. **Verify Function Exists:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'process_member_scan';
```

2. **Test Function Directly:**
```sql
SELECT process_member_scan(
  'STM-000001',  -- Replace with actual member ID
  auth.uid(),    -- Current user ID
  false,         -- auto_check_in
  'manual_entry' -- device_type
);
```

3. **Check Scanner Logs:**
```sql
SELECT * FROM scanner_access_logs 
ORDER BY scanned_at DESC 
LIMIT 10;
```

4. **Verify Permissions:**
```sql
-- Check if you have staff role
SELECT * FROM staff_profiles WHERE user_id = auth.uid();
```

### Browser Console Debugging

Open browser console (F12) and look for:
- RPC errors
- Network errors  
- Authentication errors
- Function not found errors

### Supabase Logs

Check Supabase Dashboard → Logs → Edge Functions for:
- Function execution errors
- Permission errors
- SQL errors

### Quick Verification Checklist

- [ ] Function `process_member_scan` exists in database
- [ ] Function has execute permissions for authenticated users
- [ ] `scanner_access_logs` table exists
- [ ] `scanner_settings` table exists
- [ ] User has staff role (check `staff_profiles` table)
- [ ] Member ID format is correct (STM-XXXXXX)
- [ ] Migration `20260113000000_fix_scanner_photo_url.sql` has been run

### If Still Not Working

1. Check browser console for specific error
2. Check Supabase logs for function errors
3. Verify user has staff/admin role
4. Test function directly in SQL Editor
5. Verify member exists with correct member_id format
