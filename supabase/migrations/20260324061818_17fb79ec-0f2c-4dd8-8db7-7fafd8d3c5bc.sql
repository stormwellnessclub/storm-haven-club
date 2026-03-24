
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
  v_member record;
  v_log_id uuid;
  v_check_in_id uuid;
  v_access_granted boolean := false;
  v_denial_reason text := NULL;
  v_result jsonb;
  v_payment_status jsonb;
  v_has_recent_failed_payment boolean := false;
  v_is_annual_fee_overdue boolean := false;
  v_is_dues_past_due boolean := false;
  v_is_billing_block boolean := false;
  v_has_no_subscription boolean := false;
  v_has_incomplete_subscription boolean := false;
  v_member_id_clean text;
  v_token_timestamp text;
  v_token_signature text;
  v_token_parts text[];
BEGIN
  -- Parse member ID (handle QR token format: member_id:timestamp:signature)
  IF p_member_id_text LIKE '%:%:%' THEN
    v_token_parts := string_to_array(p_member_id_text, ':');
    v_member_id_clean := v_token_parts[1];
    v_token_timestamp := v_token_parts[2];
    
    IF (extract(epoch from now()) - v_token_timestamp::bigint) > 300 THEN
      v_result := jsonb_build_object(
        'success', false,
        'access_granted', false,
        'error', 'QR code expired',
        'message', 'Please refresh your QR code'
      );
      RETURN v_result;
    END IF;
  ELSE
    v_member_id_clean := p_member_id_text;
  END IF;

  -- Find member
  SELECT * INTO v_member
  FROM members
  WHERE member_id ILIKE v_member_id_clean
     OR id::text = v_member_id_clean
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO scanner_access_logs (
      member_id_text, scanned_by, access_granted, access_denied_reason,
      device_type, scanned_at
    ) VALUES (
      p_member_id_text, p_scanned_by, false, 'member_not_found',
      p_device_type, now()
    ) RETURNING id INTO v_log_id;

    v_result := jsonb_build_object(
      'success', false,
      'access_granted', false,
      'error', 'Member not found',
      'message', 'No member found with ID: ' || p_member_id_text,
      'log_id', v_log_id
    );
    RETURN v_result;
  END IF;

  -- *** BLOCKED CHECK ***
  IF is_email_blocked(v_member.email) THEN
    INSERT INTO scanner_access_logs (
      member_id, member_id_text, scanned_by, access_granted,
      access_denied_reason, device_type, scanned_at
    ) VALUES (
      v_member.id, p_member_id_text, p_scanned_by, false,
      'access_revoked', p_device_type, now()
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', 'access_revoked',
      'is_billing_block', true,
      'member', jsonb_build_object(
        'id', v_member.id,
        'member_id', v_member.member_id,
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'status', v_member.status,
        'membership_type', v_member.membership_type,
        'email', v_member.email,
        'photo_url', v_member.photo_url
      ),
      'message', 'Access revoked',
      'log_id', v_log_id
    );
  END IF;

  -- Check for recent failed payments (last 30 days)
  SELECT EXISTS(
    SELECT 1 FROM payment_attempts
    WHERE member_id = v_member.id
      AND status = 'failed'
      AND created_at > now() - interval '30 days'
  ) INTO v_has_recent_failed_payment;

  -- Check annual fee status
  IF v_member.annual_fee_paid_at IS NOT NULL THEN
    v_is_annual_fee_overdue := v_member.annual_fee_paid_at < now() - interval '365 days';
  ELSE
    v_is_annual_fee_overdue := v_member.annual_fee_subscription_id IS NULL;
  END IF;

  v_is_dues_past_due := v_member.status = 'past_due';

  -- Check subscription status for non-cash members
  IF COALESCE(v_member.billing_type, 'stripe') != 'cash' THEN
    -- No subscription at all (and not pending activation)
    IF v_member.stripe_subscription_id IS NULL AND v_member.status NOT IN ('pending_activation', 'cancelled', 'expired') THEN
      v_has_no_subscription := true;
    END IF;
    -- Subscription exists but is in a failed/terminal state
    IF v_member.stripe_subscription_id IS NOT NULL AND 
       COALESCE(v_member.subscription_status, 'none') IN ('incomplete', 'incomplete_expired', 'canceled', 'unpaid', 'past_due') THEN
      v_has_incomplete_subscription := true;
    END IF;
  END IF;

  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_is_annual_fee_overdue,
    'isDuesPastDue', v_is_dues_past_due,
    'hasRecentFailedPayment', v_has_recent_failed_payment,
    'hasNoSubscription', v_has_no_subscription,
    'hasIncompleteSubscription', v_has_incomplete_subscription
  );

  -- Determine access
  CASE v_member.status
    WHEN 'active' THEN
      IF v_has_recent_failed_payment THEN
        v_access_granted := false;
        v_denial_reason := 'payment_failed';
        v_is_billing_block := true;
      ELSIF v_has_no_subscription THEN
        v_access_granted := false;
        v_denial_reason := 'no_active_subscription';
        v_is_billing_block := true;
      ELSIF v_has_incomplete_subscription THEN
        v_access_granted := false;
        v_denial_reason := 'subscription_incomplete';
        v_is_billing_block := true;
      ELSIF v_is_annual_fee_overdue THEN
        v_access_granted := false;
        v_denial_reason := 'annual_fee_overdue';
        v_is_billing_block := true;
      ELSE
        v_access_granted := true;
      END IF;
    WHEN 'past_due' THEN
      v_access_granted := false;
      v_denial_reason := 'payment_overdue';
      v_is_billing_block := true;
    WHEN 'pending_activation' THEN
      v_access_granted := false;
      v_denial_reason := 'pending_activation';
    WHEN 'frozen' THEN
      v_access_granted := false;
      v_denial_reason := 'membership_frozen';
    WHEN 'expired' THEN
      v_access_granted := false;
      v_denial_reason := 'membership_expired';
    WHEN 'cancelled' THEN
      v_access_granted := false;
      v_denial_reason := 'membership_cancelled';
    WHEN 'suspended' THEN
      v_access_granted := false;
      v_denial_reason := 'membership_suspended';
    ELSE
      v_access_granted := false;
      v_denial_reason := 'unknown_status';
  END CASE;

  -- Override logic: NEVER allow override for billing blocks or access_revoked
  IF p_override AND NOT v_access_granted THEN
    IF v_is_billing_block THEN
      -- Billing blocks cannot be overridden - deny regardless
      v_access_granted := false;
    ELSE
      -- Non-billing blocks (frozen, pending_activation) can be overridden
      v_access_granted := true;
    END IF;
  END IF;

  -- Auto check-in if access granted
  IF v_access_granted AND p_auto_check_in THEN
    IF NOT EXISTS(
      SELECT 1 FROM check_ins
      WHERE member_id = v_member.id
        AND checked_in_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO check_ins (
        member_id, checked_in_by, notes
      ) VALUES (
        v_member.id, p_scanned_by,
        CASE WHEN p_override THEN 'OVERRIDE: ' || COALESCE(p_override_reason, 'Admin override') ELSE NULL END
      ) RETURNING id INTO v_check_in_id;
    END IF;
  END IF;

  -- Log the scan
  INSERT INTO scanner_access_logs (
    member_id, member_id_text, scanned_by, access_granted,
    access_denied_reason, auto_checked_in, check_in_id,
    payment_status, device_type, override_used, override_reason,
    scanned_at
  ) VALUES (
    v_member.id, p_member_id_text, p_scanned_by, v_access_granted,
    CASE WHEN NOT v_access_granted OR p_override THEN v_denial_reason ELSE NULL END,
    v_check_in_id IS NOT NULL, v_check_in_id,
    v_payment_status, p_device_type, p_override, p_override_reason,
    now()
  ) RETURNING id INTO v_log_id;

  v_result := jsonb_build_object(
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
      'photo_url', v_member.photo_url
    ),
    'payment_status', v_payment_status,
    'denial_reason', v_denial_reason,
    'is_billing_block', v_is_billing_block,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'message', CASE 
      WHEN v_access_granted THEN 'Access granted'
      WHEN p_override AND v_is_billing_block THEN 'Override denied: billing issue must be resolved first'
      WHEN p_override AND NOT v_is_billing_block THEN 'Access granted with override'
      ELSE 'Access denied: ' || COALESCE(v_denial_reason, 'unknown reason')
    END
  );

  RETURN v_result;
END;
$function$;
