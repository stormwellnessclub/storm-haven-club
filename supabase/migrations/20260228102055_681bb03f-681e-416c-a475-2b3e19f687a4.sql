
-- Create blocked_persons table
CREATE TABLE public.blocked_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  reason text,
  blocked_by uuid REFERENCES auth.users(id),
  blocked_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid REFERENCES public.members(id),
  notes text,
  CONSTRAINT blocked_persons_email_unique UNIQUE (email)
);

-- Ensure email is always stored lowercase
CREATE OR REPLACE FUNCTION public.blocked_persons_lowercase_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := LOWER(TRIM(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER blocked_persons_email_lower
BEFORE INSERT OR UPDATE ON public.blocked_persons
FOR EACH ROW EXECUTE FUNCTION public.blocked_persons_lowercase_email();

-- Enable RLS
ALTER TABLE public.blocked_persons ENABLE ROW LEVEL SECURITY;

-- RLS: only admin/super_admin/manager can read
CREATE POLICY "Staff can view blocked persons"
ON public.blocked_persons FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- RLS: only admin/super_admin/manager can insert
CREATE POLICY "Staff can block persons"
ON public.blocked_persons FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- RLS: only admin/super_admin/manager can delete (unblock)
CREATE POLICY "Staff can unblock persons"
ON public.blocked_persons FOR DELETE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- RLS: only admin/super_admin/manager can update
CREATE POLICY "Staff can update blocked persons"
ON public.blocked_persons FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Allow authenticated users to check if THEIR OWN email is blocked (for portal guards)
CREATE POLICY "Users can check own blocked status"
ON public.blocked_persons FOR SELECT
TO authenticated
USING (email = current_user_email_lower());

-- Create a security definer function to check if an email is blocked
-- This avoids RLS issues when checking from RPCs
CREATE OR REPLACE FUNCTION public.is_email_blocked(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_persons
    WHERE email = LOWER(TRIM(p_email))
  )
$$;

-- Update process_member_scan (overload 1: manual entry with p_member_id_text)
CREATE OR REPLACE FUNCTION public.process_member_scan(p_member_id_text text, p_scanned_by uuid, p_auto_check_in boolean DEFAULT false, p_device_type text DEFAULT 'manual_entry'::text, p_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
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

  -- Check for recent failed payments
  SELECT EXISTS(
    SELECT 1 FROM payment_attempts
    WHERE member_id = v_member.id
      AND status = 'failed'
      AND created_at > now() - interval '30 days'
  ) INTO v_has_recent_failed_payment;

  IF v_member.annual_fee_paid_at IS NOT NULL THEN
    v_is_annual_fee_overdue := v_member.annual_fee_paid_at < now() - interval '365 days';
  ELSE
    v_is_annual_fee_overdue := v_member.annual_fee_subscription_id IS NULL;
  END IF;

  v_is_dues_past_due := v_member.status = 'past_due';

  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_is_annual_fee_overdue,
    'isDuesPastDue', v_is_dues_past_due,
    'hasRecentFailedPayment', v_has_recent_failed_payment
  );

  CASE v_member.status
    WHEN 'active' THEN
      IF v_has_recent_failed_payment THEN
        v_access_granted := false;
        v_denial_reason := 'payment_failed';
      ELSIF v_is_annual_fee_overdue AND v_member.stripe_subscription_id IS NOT NULL THEN
        v_access_granted := false;
        v_denial_reason := 'payment_overdue';
      ELSE
        v_access_granted := true;
      END IF;
    WHEN 'past_due' THEN
      v_access_granted := false;
      v_denial_reason := 'payment_overdue';
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

  IF p_override AND NOT v_access_granted THEN
    v_access_granted := true;
  END IF;

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
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'message', CASE 
      WHEN v_access_granted THEN 'Access granted'
      WHEN p_override THEN 'Access granted with override'
      ELSE 'Access denied: ' || COALESCE(v_denial_reason, 'unknown reason')
    END
  );

  RETURN v_result;
END;
$function$;

-- Update process_member_scan (overload 2: p_scanned_code)
CREATE OR REPLACE FUNCTION public.process_member_scan(p_scanned_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member RECORD;
  v_access_granted boolean := false;
  v_denial_reason text := null;
  v_check_in_id uuid := null;
  v_result jsonb;
BEGIN
  SELECT m.*, 
         et.expires_at as token_expires_at,
         et.is_revoked as token_revoked
  INTO v_member
  FROM members m
  LEFT JOIN entry_tokens et ON et.member_id = m.id AND et.token = p_scanned_code
  WHERE m.id::text = p_scanned_code 
     OR et.token = p_scanned_code;
  
  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'access_granted', false,
      'denial_reason', 'member_not_found',
      'message', 'No member found for this code'
    );
  END IF;

  -- *** BLOCKED CHECK ***
  IF is_email_blocked(v_member.email) THEN
    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', 'access_revoked',
      'member', jsonb_build_object(
        'id', v_member.id,
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'email', v_member.email,
        'membership_type', v_member.membership_type,
        'status', v_member.status,
        'subscription_status', v_member.subscription_status,
        'photo_url', v_member.photo_url
      ),
      'message', 'Access revoked'
    );
  END IF;
  
  IF v_member.status = 'active' THEN
    v_access_granted := true;
  ELSIF v_member.status = 'pending_activation' THEN
    v_denial_reason := 'pending_activation';
  ELSIF v_member.status = 'frozen' THEN
    v_denial_reason := 'frozen';
  ELSIF v_member.status = 'past_due' THEN
    v_denial_reason := 'past_due';
  ELSIF v_member.status IN ('cancelled', 'inactive', 'expired') THEN
    v_denial_reason := 'cancelled';
  ELSE
    v_denial_reason := 'unknown_status';
  END IF;
  
  IF v_access_granted AND v_member.stripe_subscription_id IS NOT NULL THEN
    IF COALESCE(v_member.subscription_status, 'none') NOT IN ('active', 'trialing') THEN
      v_access_granted := false;
      v_denial_reason := 'payment_failed';
    END IF;
  END IF;
  
  IF v_access_granted AND v_member.token_expires_at IS NOT NULL THEN
    IF v_member.token_expires_at < now() THEN
      v_access_granted := false;
      v_denial_reason := 'token_expired';
    END IF;
    IF v_member.token_revoked = true THEN
      v_access_granted := false;
      v_denial_reason := 'token_revoked';
    END IF;
  END IF;
  
  IF v_access_granted THEN
    INSERT INTO check_ins (member_id, checked_in_at)
    VALUES (v_member.id, now())
    RETURNING id INTO v_check_in_id;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'membership_type', v_member.membership_type,
      'status', v_member.status,
      'subscription_status', v_member.subscription_status,
      'photo_url', v_member.photo_url
    )
  );
  
  RETURN v_result;
END;
$function$;

-- Update create_atomic_class_booking to check blocked status
CREATE OR REPLACE FUNCTION public.create_atomic_class_booking(_session_id uuid, _user_id uuid, _payment_method text, _member_credit_id uuid DEFAULT NULL::uuid, _pass_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _member_id uuid;
  _booking_id uuid;
  _session_record record;
  _credit_record record;
  _pass_record record;
  _existing_booking record;
  _user_email text;
BEGIN
  -- *** BLOCKED CHECK ***
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  IF is_email_blocked(_user_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your access has been revoked. Please contact the club.'
    );
  END IF;

  -- PAYMENT VALIDATION
  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid payment method. Please use class credits or a class pass.'
    );
  END IF;
  
  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class credits specified. Please purchase a class pass.'
    );
  END IF;
  
  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class pass specified. Please select a class pass.'
    );
  END IF;

  SELECT * INTO _session_record
  FROM class_sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class has been cancelled');
  END IF;

  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class is full');
  END IF;

  SELECT * INTO _existing_booking
  FROM class_bookings
  WHERE session_id = _session_id AND user_id = _user_id AND status = 'confirmed';

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this class');
  END IF;

  SELECT id INTO _member_id
  FROM members
  WHERE user_id = _user_id AND status = 'active';

  IF _payment_method = 'credits' AND _member_credit_id IS NOT NULL THEN
    SELECT * INTO _credit_record
    FROM member_credits
    WHERE id = _member_credit_id AND credits_remaining > 0 AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available class credits');
    END IF;

    UPDATE member_credits SET credits_remaining = credits_remaining - 1 WHERE id = _member_credit_id;
  END IF;

  IF _payment_method = 'pass' AND _pass_id IS NOT NULL THEN
    SELECT * INTO _pass_record
    FROM class_passes
    WHERE id = _pass_id AND user_id = _user_id AND status = 'active' AND classes_remaining > 0 AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired class pass');
    END IF;

    UPDATE class_passes
    SET classes_remaining = classes_remaining - 1,
        status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END
    WHERE id = _pass_id;
  END IF;

  INSERT INTO class_bookings (
    session_id, user_id, member_id, status, payment_method,
    member_credit_id, pass_id, credits_used, booked_at
  ) VALUES (
    _session_id, _user_id, _member_id, 'confirmed', _payment_method,
    _member_credit_id, _pass_id,
    CASE WHEN _payment_method = 'credits' THEN 1 ELSE 0 END,
    NOW()
  ) RETURNING id INTO _booking_id;

  UPDATE class_sessions SET current_enrollment = current_enrollment + 1 WHERE id = _session_id;

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$function$;
