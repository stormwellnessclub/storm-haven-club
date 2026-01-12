# Member Scanner Fix

## Issue
The member scanner is not working. This could be due to:
1. Missing database function
2. Missing `photo_url` in function return
3. Migration not run

## Solution

### Step 1: Verify Function Exists

Run this in Supabase SQL Editor:

```sql
SELECT proname, proargnames, prorettype 
FROM pg_proc 
WHERE proname = 'process_member_scan';
```

If no results, the function doesn't exist and you need to run the migration.

### Step 2: Check if Migration Was Run

The scanner function should be created by:
- `supabase/migrations/20260107000000_scanner_system.sql` (initial)
- `supabase/migrations/20260112000002_check_in_duplicate_prevention.sql` (updated)

### Step 3: Fix Missing photo_url

The function return doesn't include `photo_url`, but the frontend expects it. Update the function:

```sql
-- Update process_member_scan to include photo_url in return
CREATE OR REPLACE FUNCTION process_member_scan(
  p_member_id_text text,
  p_scanned_by uuid,
  p_auto_check_in boolean,
  p_device_type text,
  p_override boolean DEFAULT false,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_payment_status jsonb;
  v_access_granted boolean := false;
  v_denial_reason text;
  v_check_in_id uuid;
  v_log_id uuid;
  v_existing_check_in_id uuid;
  v_duplicate_check_in_window interval := interval '30 minutes';
BEGIN
  -- Lookup member by member_id text (STM-000001)
  SELECT * INTO v_member
  FROM members
  WHERE member_id = p_member_id_text;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'member_not_found',
      'message', 'Member ID not found'
    );
  END IF;
  
  -- Check membership status
  IF v_member.status IN ('expired', 'cancelled') THEN
    v_denial_reason := 'membership_' || v_member.status;
    v_access_granted := false;
  ELSIF v_member.status = 'frozen' THEN
    v_denial_reason := 'membership_frozen';
    v_access_granted := false;
  ELSE
    -- Check payment status
    SELECT jsonb_build_object(
      'isAnnualFeeOverdue', 
        CASE WHEN v_member.annual_fee_paid_at IS NULL 
          OR v_member.annual_fee_paid_at < now() - interval '1 year' 
        THEN true ELSE false END,
      'isDuesPastDue',
        CASE WHEN v_member.status = 'past_due' THEN true ELSE false END
    ) INTO v_payment_status;
    
    IF (v_payment_status->>'isAnnualFeeOverdue')::boolean 
       OR (v_payment_status->>'isDuesPastDue')::boolean THEN
      IF p_override THEN
        v_access_granted := true;
      ELSE
        v_denial_reason := 'payment_overdue';
        v_access_granted := false;
      END IF;
    ELSE
      v_access_granted := true;
    END IF;
  END IF;
  
  -- Check for duplicate check-in within the time window
  -- Only check if auto_check_in is enabled and access is granted
  IF v_access_granted AND p_auto_check_in THEN
    SELECT id INTO v_existing_check_in_id
    FROM check_ins
    WHERE member_id = v_member.id
      AND checked_out_at IS NULL  -- Not checked out yet
      AND checked_in_at > now() - v_duplicate_check_in_window  -- Within last 30 minutes
    ORDER BY checked_in_at DESC
    LIMIT 1;
    
    IF v_existing_check_in_id IS NOT NULL THEN
      -- Duplicate check-in detected - return existing check-in ID
      v_check_in_id := v_existing_check_in_id;
      v_access_granted := true; -- Still grant access, just don't create duplicate
    ELSE
      -- No duplicate found - create new check-in
      INSERT INTO check_ins (member_id, checked_in_by, notes)
      VALUES (v_member.id, p_scanned_by, 'Auto check-in via scanner')
      RETURNING id INTO v_check_in_id;
    END IF;
  END IF;
  
  -- Log the scan attempt
  INSERT INTO scanner_access_logs (
    member_id,
    member_id_text,
    scanned_by,
    access_granted,
    access_denied_reason,
    auto_checked_in,
    check_in_id,
    payment_status,
    override_used,
    override_reason,
    device_type
  )
  VALUES (
    v_member.id,
    p_member_id_text,
    p_scanned_by,
    v_access_granted,
    v_denial_reason,
    p_auto_check_in AND v_access_granted,
    v_check_in_id,
    v_payment_status,
    p_override,
    p_override_reason,
    p_device_type
  )
  RETURNING id INTO v_log_id;
  
  -- Return result WITH photo_url
  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_id', v_member.member_id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'status', v_member.status,
      'membership_type', v_member.membership_type,
      'email', v_member.email,
      'photo_url', v_member.photo_url  -- ADD THIS LINE
    ),
    'payment_status', v_payment_status,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'duplicate_check_in', CASE WHEN v_existing_check_in_id IS NOT NULL AND v_check_in_id = v_existing_check_in_id THEN true ELSE false END
  );
END;
$$;
```

### Step 4: Verify Permissions

Make sure the function has execute permissions:

```sql
GRANT EXECUTE ON FUNCTION process_member_scan TO authenticated;
```

### Step 5: Test

1. Go to `/admin/scanner`
2. Try scanning a member ID (e.g., `STM-000001`)
3. Check browser console for errors
4. Check Supabase logs for function errors

## Common Issues

1. **Function doesn't exist**: Run the migration files
2. **Permission denied**: Check RLS policies and function permissions
3. **Member not found**: Verify member_id format (should be like `STM-000001`)
4. **Photo URL missing**: Function updated above includes photo_url

## Debugging

Check browser console for:
- RPC function errors
- Network errors
- Authentication errors

Check Supabase logs for:
- Function execution errors
- Permission errors
- SQL errors
