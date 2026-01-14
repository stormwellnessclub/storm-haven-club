-- Fix process_member_scan to parse rotating QR tokens
-- Token format: MEMBER_ID:TIMESTAMP:SIGNATURE (e.g., STM-001:1768401000000:734e17da...)
-- Also supports plain member_id for manual entry

CREATE OR REPLACE FUNCTION public.process_member_scan(
  p_member_id_text text, 
  p_scanned_by uuid, 
  p_auto_check_in boolean DEFAULT false, 
  p_device_type text DEFAULT 'manual_entry'::text, 
  p_override boolean DEFAULT false, 
  p_override_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member RECORD;
  v_access_granted BOOLEAN := false;
  v_denial_reason TEXT;
  v_check_in_id UUID;
  v_log_id UUID;
  v_payment_status JSONB;
  v_actual_member_id TEXT;
  v_token_parts TEXT[];
  v_token_timestamp BIGINT;
  v_current_timestamp BIGINT;
  v_token_age_seconds INTEGER;
BEGIN
  -- Parse token format: MEMBER_ID:TIMESTAMP:SIGNATURE
  -- Or plain member_id (STM-XXXXXX)
  IF p_member_id_text LIKE '%:%:%' THEN
    -- Token format detected - split by colon
    v_token_parts := string_to_array(p_member_id_text, ':');
    v_actual_member_id := v_token_parts[1];
    
    -- Validate token has correct structure (at least 3 parts)
    IF array_length(v_token_parts, 1) >= 3 THEN
      -- Extract timestamp and validate expiry (5 minute window)
      BEGIN
        v_token_timestamp := v_token_parts[2]::BIGINT;
        v_current_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
        v_token_age_seconds := (v_current_timestamp - v_token_timestamp) / 1000;
        
        -- Token expired if older than 5 minutes (300 seconds)
        IF v_token_age_seconds > 300 THEN
          INSERT INTO public.scanner_access_logs (
            member_id_text, scanned_by, access_granted, 
            access_denied_reason, device_type
          ) VALUES (
            p_member_id_text, p_scanned_by, false, 
            'token_expired', p_device_type
          )
          RETURNING id INTO v_log_id;
          
          RETURN jsonb_build_object(
            'success', true,
            'access_granted', false,
            'denial_reason', 'token_expired',
            'log_id', v_log_id,
            'message', 'QR code has expired. Please refresh the QR code.'
          );
        END IF;
        
        -- Token is within valid time window, proceed with member lookup
        
      EXCEPTION WHEN OTHERS THEN
        -- Invalid timestamp format, try to use first part as member_id anyway
        v_actual_member_id := v_token_parts[1];
      END;
    ELSE
      -- Malformed token with colons but not enough parts, use first part
      v_actual_member_id := v_token_parts[1];
    END IF;
  ELSE
    -- Plain member ID (manual entry or legacy format)
    v_actual_member_id := p_member_id_text;
  END IF;

  -- Find member by extracted/parsed member_id
  SELECT * INTO v_member 
  FROM public.members 
  WHERE member_id = v_actual_member_id;
  
  IF v_member IS NULL THEN
    INSERT INTO public.scanner_access_logs (
      member_id_text, scanned_by, access_granted, 
      access_denied_reason, device_type
    ) VALUES (
      p_member_id_text, p_scanned_by, false, 
      'member_not_found', p_device_type
    )
    RETURNING id INTO v_log_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', 'member_not_found',
      'log_id', v_log_id,
      'message', 'Member not found'
    );
  END IF;

  -- Build payment status
  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_member.annual_fee_paid_at IS NULL 
      OR v_member.annual_fee_paid_at < (NOW() - INTERVAL '1 year'),
    'isDuesPastDue', v_member.stripe_subscription_id IS NULL
  );

  -- Determine access based on status
  IF v_member.status = 'active' THEN
    IF (v_payment_status->>'isAnnualFeeOverdue')::boolean 
       OR (v_payment_status->>'isDuesPastDue')::boolean THEN
      v_denial_reason := 'payment_overdue';
    ELSE
      v_access_granted := true;
    END IF;
  ELSIF v_member.status = 'frozen' THEN
    v_denial_reason := 'membership_frozen';
  ELSIF v_member.status IN ('cancelled', 'suspended') THEN
    v_denial_reason := 'membership_' || v_member.status;
  ELSE
    v_denial_reason := 'membership_inactive';
  END IF;

  -- Handle override
  IF p_override AND NOT v_access_granted THEN
    v_access_granted := true;
    v_denial_reason := NULL;
  END IF;

  -- Auto check-in if enabled and access granted
  IF v_access_granted AND p_auto_check_in THEN
    INSERT INTO public.check_ins (member_id, checked_in_at)
    VALUES (v_member.id, NOW())
    RETURNING id INTO v_check_in_id;
  END IF;

  -- Log the scan (store original token for audit trail)
  INSERT INTO public.scanner_access_logs (
    member_id, member_id_text, scanned_by, access_granted,
    access_denied_reason, auto_checked_in, check_in_id,
    payment_status, override_used, override_reason, device_type
  ) VALUES (
    v_member.id, p_member_id_text, p_scanned_by, v_access_granted,
    v_denial_reason, (v_check_in_id IS NOT NULL), v_check_in_id,
    v_payment_status, p_override, p_override_reason, p_device_type
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_id', v_member.member_id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'membership_type', v_member.membership_type,
      'status', v_member.status,
      'email', v_member.email,
      'photo_url', v_member.photo_url
    ),
    'payment_status', v_payment_status
  );
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.process_member_scan TO authenticated;