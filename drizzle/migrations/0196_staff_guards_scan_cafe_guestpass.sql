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
  v_eligibility jsonb;
  v_payment_status jsonb;
  v_member_id_clean text;
  v_token_timestamp text;
  v_token_parts text[];
  v_is_annual_fee_overdue boolean := false;
  v_is_dues_past_due boolean := false;
  v_today date;
  v_todays_class_bookings jsonb := '[]'::jsonb;
  v_todays_spa_bookings jsonb := '[]'::jsonb;
  v_valid_class_passes integer := 0;
BEGIN
  -- Only staff (or server code) may scan members in
  IF auth.uid() IS NULL THEN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
      RETURN jsonb_build_object('success', false, 'access_granted', false, 'error', 'Not allowed', 'message', 'Staff sign-in required');
    END IF;
  ELSIF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff','class_instructor','cafe_staff','childcare_staff']::app_role[]) THEN
    RETURN jsonb_build_object('success', false, 'access_granted', false, 'error', 'Not allowed', 'message', 'Staff sign-in required');
  END IF;

  -- Parse QR token (member_id:timestamp:signature)
  IF p_member_id_text LIKE '%:%:%' THEN
    v_token_parts := string_to_array(p_member_id_text, ':');
    v_member_id_clean := v_token_parts[1];
    v_token_timestamp := v_token_parts[2];
    IF (extract(epoch from now()) - v_token_timestamp::bigint) > 300 THEN
      RETURN jsonb_build_object(
        'success', false, 'access_granted', false,
        'error', 'QR code expired',
        'message', 'Please refresh your QR code'
      );
    END IF;
  ELSE
    v_member_id_clean := p_member_id_text;
  END IF;

  -- Find member
  SELECT * INTO v_member
  FROM members
  WHERE member_id ILIKE v_member_id_clean OR id::text = v_member_id_clean
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO scanner_access_logs (
      member_id_text, scanned_by, access_granted, access_denied_reason,
      device_type, scanned_at
    ) VALUES (
      p_member_id_text, p_scanned_by, false, 'member_not_found', p_device_type, now()
    ) RETURNING id INTO v_log_id;
    RETURN jsonb_build_object(
      'success', false, 'access_granted', false,
      'error', 'Member not found',
      'message', 'No member found with ID: ' || p_member_id_text,
      'log_id', v_log_id
    );
  END IF;

  -- Single eligibility decision
  v_eligibility := public.evaluate_member_check_in_eligibility(v_member.id);
  v_access_granted := (v_eligibility->>'access_granted')::boolean;
  v_denial_reason := v_eligibility->>'denial_reason';

  -- Payload kept for backwards compat with frontend (legacy fields)
  IF v_member.annual_fee_paid_at IS NOT NULL THEN
    v_is_annual_fee_overdue := v_member.annual_fee_paid_at < now() - interval '365 days';
  ELSE
    v_is_annual_fee_overdue := v_member.annual_fee_subscription_id IS NULL;
  END IF;
  v_is_dues_past_due := v_member.status = 'past_due';

  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_is_annual_fee_overdue,
    'isDuesPastDue', v_is_dues_past_due,
    'hasRecentFailedPayment', false,
    'hasUnresolvedMembershipArrears', COALESCE((v_eligibility->>'has_unresolved_membership_arrears')::boolean, false)
  );

  -- For frozen members: surface today's bookings + remaining class passes so
  -- front desk can manually check them in for what they have paid for.
  IF v_denial_reason = 'membership_frozen' THEN
    v_today := (now() AT TIME ZONE 'America/Detroit')::date;

    -- Today's class bookings (confirmed and not yet checked in)
    SELECT COALESCE(jsonb_agg(b ORDER BY b->>'start_time'), '[]'::jsonb) INTO v_todays_class_bookings
    FROM (
      SELECT jsonb_build_object(
        'id', cb.id,
        'class_name', COALESCE(ct.name, 'Class'),
        'start_time', cs.start_time::text,
        'session_date', cs.session_date::text,
        'status', cb.status,
        'already_checked_in', cb.checked_in_at IS NOT NULL,
        'room', cs.room
      ) AS b
      FROM class_bookings cb
      JOIN class_sessions cs ON cs.id = cb.session_id
      LEFT JOIN class_types ct ON ct.id = cs.class_type_id
      WHERE cb.member_id = v_member.id
        AND cs.session_date = v_today
        AND cb.status = 'confirmed'
        AND cs.is_cancelled = false
    ) sub;

    -- Today's spa appointments (booked / scheduled, not cancelled, not yet checked in)
    SELECT COALESCE(jsonb_agg(s ORDER BY s->>'appointment_time'), '[]'::jsonb) INTO v_todays_spa_bookings
    FROM (
      SELECT jsonb_build_object(
        'id', sa.id,
        'service_name', sa.service_name,
        'service_category', sa.service_category,
        'appointment_time', sa.appointment_time::text,
        'duration_minutes', sa.duration_minutes,
        'status', sa.status,
        'already_checked_in', sa.checked_in_at IS NOT NULL,
        'therapist', (
          SELECT COALESCE(p.first_name || ' ' || p.last_name, NULL)
          FROM profiles p
          WHERE p.user_id = sa.staff_id
          LIMIT 1
        )
      ) AS s
      FROM spa_appointments sa
      WHERE sa.member_id = v_member.id
        AND sa.appointment_date = v_today
        AND sa.status NOT IN ('cancelled', 'completed', 'no_show')
    ) sub;

    -- Remaining (active, non-expired) class passes the member can use as a drop-in
    SELECT COALESCE(SUM(cp.classes_remaining), 0) INTO v_valid_class_passes
    FROM class_passes cp
    WHERE cp.user_id = v_member.user_id
      AND cp.status = 'active'
      AND cp.classes_remaining > 0
      AND cp.expires_at > now()
      AND cp.pass_type NOT ILIKE 'kids_care%';
  END IF;

  -- Override
  IF p_override AND NOT v_access_granted THEN
    v_access_granted := true;
  END IF;

  -- Auto check-in
  IF v_access_granted AND p_auto_check_in THEN
    IF NOT EXISTS(
      SELECT 1 FROM check_ins
      WHERE member_id = v_member.id
        AND checked_in_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO check_ins (member_id, checked_in_by, notes)
      VALUES (
        v_member.id, p_scanned_by,
        CASE WHEN p_override THEN 'OVERRIDE: ' || COALESCE(p_override_reason, 'Admin override') ELSE NULL END
      ) RETURNING id INTO v_check_in_id;
    END IF;
  END IF;

  INSERT INTO scanner_access_logs (
    member_id, member_id_text, scanned_by, access_granted,
    access_denied_reason, auto_checked_in, check_in_id,
    payment_status, device_type, override_used, override_reason, scanned_at
  ) VALUES (
    v_member.id, p_member_id_text, p_scanned_by, v_access_granted,
    CASE WHEN NOT v_access_granted OR p_override THEN v_denial_reason ELSE NULL END,
    v_check_in_id IS NOT NULL, v_check_in_id,
    v_payment_status, p_device_type, p_override, p_override_reason, now()
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'member', jsonb_build_object(
      'id', v_member.id, 'member_id', v_member.member_id,
      'first_name', v_member.first_name, 'last_name', v_member.last_name,
      'status', v_member.status, 'membership_type', v_member.membership_type,
      'email', v_member.email, 'photo_url', v_member.photo_url
    ),
    'payment_status', v_payment_status,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'todays_class_bookings', v_todays_class_bookings,
    'todays_spa_bookings', v_todays_spa_bookings,
    'valid_class_passes', v_valid_class_passes,
    'message', CASE
      WHEN v_access_granted AND p_override THEN 'Access granted with override'
      WHEN v_access_granted THEN 'Access granted'
      ELSE 'Access denied: ' || COALESCE(v_denial_reason, 'unknown reason')
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_cafe_credit_balance(_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_balance bigint; v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
      RETURN jsonb_build_object('balance_cents', 0, 'prepaid_items', '[]'::jsonb);
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM members WHERE id = _member_id AND user_id = auth.uid())
    AND NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','cafe_staff']::app_role[]) THEN
    RETURN jsonb_build_object('balance_cents', 0, 'prepaid_items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) - public.cafe_pending_expiry_cents(_member_id) INTO v_balance
  FROM cafe_credit_ledger WHERE member_id = _member_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id', p.menu_item_id, 'quantity_remaining', p.quantity_remaining,
    'item_name', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m.brand_name, m.item_name, m.flavor)), ''), 'Item'),
    'price', m.price
  )) FILTER (WHERE p.quantity_remaining > 0), '[]'::jsonb) INTO v_items
  FROM cafe_prepaid_items p LEFT JOIN cafe_menu_items m ON m.id = p.menu_item_id
  WHERE p.member_id = _member_id;
  RETURN jsonb_build_object('balance_cents', v_balance, 'prepaid_items', v_items);
END $function$;

REVOKE EXECUTE ON FUNCTION public.process_member_scan(text, uuid, boolean, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_member_scan(text, uuid, boolean, text, boolean, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_member_cafe_credit_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_cafe_credit_balance(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_guest_pass_used(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guest_pass_used(uuid) TO service_role;