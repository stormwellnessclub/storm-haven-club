CREATE OR REPLACE FUNCTION public.get_member_attendance_pattern(p_member_id uuid, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_total_classes INTEGER;
  v_avg_per_week DECIMAL;
  v_preferred_days TEXT[];
BEGIN
  -- Access check: only the people allowed to see this data may call it.
  IF NOT (coalesce(auth.jwt()->>'role', 'service_role') = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = p_member_id AND m.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Get total classes attended in last N days
  SELECT COUNT(*)
  INTO v_total_classes
  FROM public.member_activities
  WHERE member_id = p_member_id
    AND activity_type = 'class_attended'
    AND created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL;

  -- Calculate average classes per week
  v_avg_per_week := (v_total_classes::DECIMAL / GREATEST(p_days, 1)) * 7;

  -- Get preferred days of week
  SELECT ARRAY_AGG(DISTINCT day_name)
  INTO v_preferred_days
  FROM (
    SELECT 
      TO_CHAR((activity_data->>'session_date')::date, 'Day') as day_name
    FROM public.member_activities
    WHERE member_id = p_member_id
      AND activity_type = 'class_attended'
      AND created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY day_name
    ORDER BY COUNT(*) DESC
    LIMIT 3
  ) sub;

  -- Build result JSON
  v_result := jsonb_build_object(
    'total_classes', v_total_classes,
    'period_days', p_days,
    'avg_classes_per_week', ROUND(v_avg_per_week, 2),
    'preferred_days', COALESCE(v_preferred_days, ARRAY[]::TEXT[]),
    'check_ins_count', (
      SELECT COUNT(*)
      FROM public.check_ins
      WHERE member_id = p_member_id
        AND checked_in_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    )
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_arrears_summary(p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_owed_cents integer;
  v_unpaid_count integer;
  v_unpaid_periods jsonb;
  v_latest_failure jsonb;
BEGIN
  -- Access check: only the people allowed to see this data may call it.
  IF NOT (coalesce(auth.jwt()->>'role', 'service_role') = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = p_member_id AND m.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Total owed
  SELECT COALESCE(SUM(amount_due_cents - amount_paid_cents), 0), COUNT(*)
  INTO v_total_owed_cents, v_unpaid_count
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial');

  -- Unpaid periods detail
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'billing_type', billing_type,
      'period_start', period_start,
      'period_end', period_end,
      'amount_due_cents', amount_due_cents,
      'amount_paid_cents', amount_paid_cents,
      'status', status,
      'stripe_invoice_id', stripe_invoice_id,
      'failure_message', failure_message,
      'decline_code', decline_code,
      'attempt_count', attempt_count,
      'next_retry_at', next_retry_at,
      'created_at', created_at
    ) ORDER BY period_start DESC
  ), '[]'::jsonb)
  INTO v_unpaid_periods
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial');

  -- Latest failure info
  SELECT jsonb_build_object(
    'failure_message', failure_message,
    'decline_code', decline_code,
    'attempt_count', attempt_count,
    'next_retry_at', next_retry_at,
    'stripe_invoice_id', stripe_invoice_id
  )
  INTO v_latest_failure
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial')
    AND failure_message IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total_owed_cents', v_total_owed_cents,
    'unpaid_count', v_unpaid_count,
    'unpaid_periods', v_unpaid_periods,
    'latest_failure', COALESCE(v_latest_failure, '{}'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_payment_history(p_member_id uuid, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSON;
BEGIN
  -- Access check: only the people allowed to see this data may call it.
  IF NOT (coalesce(auth.jwt()->>'role', 'service_role') = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = p_member_id AND m.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
    SELECT json_build_object(
        'payment_attempts', (
            SELECT json_agg(attempt_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'invoice_id', invoice_id,
                    'invoice_number', invoice_number,
                    'amount', amount,
                    'currency', currency,
                    'status', status,
                    'attempt_number', attempt_number,
                    'failure_message', failure_message,
                    'decline_reason', decline_reason,
                    'created_at', created_at,
                    'succeeded_at', succeeded_at,
                    'failed_at', failed_at
                ) as attempt_data,
                created_at
                FROM payment_attempts
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT p_limit
            ) attempts
        ),
        'status_history', (
            SELECT json_agg(history_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'old_status', old_status,
                    'new_status', new_status,
                    'change_reason', change_reason,
                    'changed_by', changed_by,
                    'created_at', created_at
                ) as history_data,
                created_at
                FROM subscription_status_history
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT 20
            ) history
        ),
        'payment_method_updates', (
            SELECT json_agg(pm_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'event_type', event_type,
                    'card_last4', card_last4,
                    'card_brand', card_brand,
                    'card_exp_month', card_exp_month,
                    'card_exp_year', card_exp_year,
                    'is_default', is_default,
                    'created_at', created_at
                ) as pm_data,
                created_at
                FROM payment_method_updates
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT 20
            ) pm_updates
        ),
        'summary', (
            SELECT json_build_object(
                'total_payments', COUNT(*) FILTER (WHERE status = 'succeeded'),
                'total_amount_paid', COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0),
                'failed_payments', COUNT(*) FILTER (WHERE status = 'failed'),
                'last_successful_payment', MAX(succeeded_at)
            )
            FROM payment_attempts
            WHERE member_id = p_member_id
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dunning_efficiency(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSON;
BEGIN
  -- Access check: only the people allowed to see this data may call it.
  IF NOT (coalesce(auth.jwt()->>'role', 'service_role') = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[])) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
    SELECT json_build_object(
        'total_failed_first_attempts', COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1),
        'recovered_on_retry', COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1),
        'recovery_rate', CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1)::NUMERIC / 
                       COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1) * 100), 2)
            ELSE 0
        END,
        'average_attempts_to_success', COALESCE(
            ROUND(AVG(attempt_number) FILTER (WHERE status = 'succeeded' AND attempt_number > 1), 2), 0
        ),
        'top_decline_reasons', (
            SELECT json_agg(reason_data)
            FROM (
                SELECT json_build_object(
                    'reason', COALESCE(decline_reason, decline_code, 'unknown'),
                    'count', COUNT(*)
                ) as reason_data
                FROM payment_attempts
                WHERE status = 'failed'
                AND created_at BETWEEN p_start_date AND p_end_date
                GROUP BY COALESCE(decline_reason, decline_code, 'unknown')
                ORDER BY COUNT(*) DESC
                LIMIT 5
            ) top_reasons
        ),
        'amount_recovered', COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded' AND attempt_number > 1), 0),
        'amount_lost', COALESCE(
            SUM(amount) FILTER (WHERE status = 'failed' AND invoice_id NOT IN (
                SELECT invoice_id FROM payment_attempts WHERE status = 'succeeded'
            )), 0
        )
    ) INTO v_result
    FROM payment_attempts
    WHERE created_at BETWEEN p_start_date AND p_end_date;
    
    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_instructor_pay_period(_period_id uuid)
 RETURNS instructor_pay_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.instructor_pay_periods;
BEGIN
  -- Access check: only the people allowed to see this data may call it.
  IF NOT (coalesce(auth.jwt()->>'role', 'service_role') = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[])) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.instructor_pay_periods WHERE id = _period_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Pay period not found'; END IF;
  IF p.status = 'paid' THEN RETURN p; END IF;

  DELETE FROM public.instructor_pay_items
   WHERE period_id = p.id AND is_manual = false;

  INSERT INTO public.instructor_pay_items
    (period_id, instructor_id, session_id, item_date, start_time, description,
     attendance_count, rate, amount, is_paid_class)
  SELECT p.id, p.instructor_id, s.id, s.session_date, s.start_time,
         COALESCE(ct.name, 'Class'),
         att.cnt,
         CASE WHEN att.cnt > 0 THEN p.rate_per_class ELSE 0 END,
         CASE WHEN att.cnt > 0 THEN p.rate_per_class ELSE 0 END,
         att.cnt > 0
    FROM public.class_sessions s
    LEFT JOIN public.class_types ct ON ct.id = s.class_type_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
        FROM public.class_bookings b
       WHERE b.session_id = s.id
         AND b.status <> 'cancelled'
         AND b.checked_in_at IS NOT NULL
    ) att
   WHERE s.instructor_id = p.instructor_id
     AND s.is_cancelled = false
     AND s.session_date BETWEEN p.start_date AND p.end_date;

  UPDATE public.instructor_pay_periods
     SET total_amount = COALESCE((SELECT SUM(amount) FROM public.instructor_pay_items WHERE period_id = p.id), 0),
         updated_at = now()
   WHERE id = p.id
  RETURNING * INTO p;

  RETURN p;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_gift_card_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.gift_cards%ROWTYPE;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Enter a gift card code');
  END IF;

  SELECT * INTO c FROM public.gift_cards
  WHERE upper(code) = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Gift card not found');
  END IF;
  IF c.status = 'void' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card was cancelled');
  END IF;
  IF c.status IN ('pending','scheduled') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card is not active yet');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card has expired');
  END IF;
  IF c.balance_cents <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card has no remaining balance');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', c.id,
    'code', c.code,
    'balance_cents', c.balance_cents,
    'amount_cents', c.amount_cents,
    'service_label', c.service_label,
    'expires_at', c.expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.effective_waiver_status(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, status text, source text, signed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Staff see everyone they ask about; anyone else only their own status.
  WITH ids AS (SELECT u AS user_id FROM unnest(_user_ids) AS u
    WHERE coalesce(auth.jwt()->>'role', 'service_role') = 'service_role'
       OR u = auth.uid()
       OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff','class_instructor','cafe_staff','childcare_staff']::app_role[])),
  nmp AS (SELECT n.user_id, bool_or(n.waiver_signed) AS waiver_signed, min(n.waiver_signed_at) AS waiver_signed_at
    FROM non_member_profiles n WHERE n.user_id = ANY(_user_ids) GROUP BY n.user_id),
  prof AS (SELECT p.user_id, bool_or(p.waiver_signed) AS waiver_signed, min(p.waiver_signed_at) AS waiver_signed_at
    FROM profiles p WHERE p.user_id = ANY(_user_ids) GROUP BY p.user_id),
  first_booking AS (SELECT cb.user_id, MIN(cb.created_at) AS ts FROM class_bookings cb
    WHERE cb.user_id = ANY(_user_ids) AND cb.status IN ('confirmed','completed','no_show') GROUP BY cb.user_id),
  first_pass AS (SELECT cp.user_id, MIN(cp.created_at) AS ts FROM class_passes cp
    WHERE cp.user_id = ANY(_user_ids) AND cp.status IN ('active','exhausted','expired') GROUP BY cp.user_id)
  SELECT i.user_id,
    CASE WHEN nmp.waiver_signed IS TRUE OR prof.waiver_signed IS TRUE OR fb.ts IS NOT NULL OR fp.ts IS NOT NULL
      THEN 'signed' ELSE 'unsigned' END::text,
    CASE WHEN nmp.waiver_signed IS TRUE OR prof.waiver_signed IS TRUE THEN 'explicit'
      WHEN fb.ts IS NOT NULL THEN 'inferred_booking' WHEN fp.ts IS NOT NULL THEN 'inferred_pass' ELSE 'none' END::text,
    COALESCE(prof.waiver_signed_at, nmp.waiver_signed_at, fb.ts, fp.ts)
  FROM ids i
  LEFT JOIN nmp ON nmp.user_id = i.user_id
  LEFT JOIN prof ON prof.user_id = i.user_id
  LEFT JOIN first_booking fb ON fb.user_id = i.user_id
  LEFT JOIN first_pass fp ON fp.user_id = i.user_id
$function$;

CREATE OR REPLACE FUNCTION public.book_spa_package_session(p_user_id uuid, p_service_key text, p_zone_id uuid, p_visit_type text, p_date date, p_time time without time zone, p_client_package_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_check_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.spa_services; z public.spa_treatment_zones; w record; c record; v_member uuid; a public.spa_appointments;
  v_now timestamp := now() AT TIME ZONE 'America/Detroit'; v_end time;
BEGIN
  SELECT * INTO s FROM public.spa_services WHERE service_key = p_service_key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This treatment is not open for booking.'); END IF;
  SELECT * INTO z FROM public.spa_treatment_zones WHERE id = p_zone_id AND service_key = p_service_key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Please choose a treatment area.'); END IF;
  IF z.booking_mode <> 'book' THEN RETURN jsonb_build_object('ok', false, 'code', 'request_only', 'error', 'That area takes appointment requests for now.'); END IF;
  IF p_visit_type IS NULL OR p_visit_type NOT IN ('first','returning') THEN RETURN jsonb_build_object('ok', false, 'error', 'Please choose first or returning visit.'); END IF;
  IF p_date + p_time < v_now + interval '2 hours' THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a time at least 2 hours from now.'); END IF;
  IF p_date > v_now::date + 93 THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a date within the next three months.'); END IF;
  v_end := p_time + make_interval(mins => s.duration_minutes);
  IF v_end <= p_time THEN RETURN jsonb_build_object('ok', false, 'error', 'That time is not available.'); END IF;
  SELECT therapist_id, room_id INTO w FROM public.spa_service_availability
   WHERE service_id = s.id AND is_active
     AND ((specific_date = p_date) OR (specific_date IS NULL AND day_of_week = extract(dow FROM p_date)::int))
     AND (starts_on IS NULL OR p_date >= starts_on)
     AND start_time <= p_time AND v_end <= end_time
   ORDER BY (therapist_id IS NOT NULL AND room_id IS NOT NULL) DESC, (therapist_id IS NOT NULL) DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'slot_taken', 'error', 'That time is not available. Please pick another.'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('spa-slot-' || COALESCE(w.room_id::text, '') || '-' || p_date::text));
  PERFORM pg_advisory_xact_lock(hashtext('spa-staff-' || COALESCE(w.therapist_id::text, '') || '-' || p_date::text));
  SELECT * INTO c FROM public.check_spa_appointment_conflict(p_date, p_time, s.duration_minutes, s.cleanup_minutes, w.therapist_id, w.room_id, NULL);
  IF c.has_conflict THEN RETURN jsonb_build_object('ok', false, 'code', 'slot_taken', 'error', 'Sorry, that time was just taken. Please pick another.'); END IF;
  IF p_check_only THEN RETURN jsonb_build_object('ok', true, 'therapist_id', w.therapist_id, 'room_id', w.room_id); END IF;
  IF p_client_package_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a treatment option.'); END IF;
  SELECT id INTO v_member FROM public.members WHERE user_id = p_user_id AND status <> 'cancelled' LIMIT 1;
  INSERT INTO public.spa_appointments(user_id, member_id, service_id, service_name, service_category, service_price, member_price,
    appointment_date, appointment_time, duration_minutes, cleanup_minutes, status, member_notes, payment_method, payment_intent_id,
    amount_paid, staff_id, room_id, created_by_user_id, created_via, treatment_zone_id, visit_type, client_package_id)
  SELECT p_user_id, v_member, s.id::text, s.name, s.category, s.price, NULL,
    p_date, p_time, s.duration_minutes, s.cleanup_minutes, 'confirmed', NULLIF(trim(COALESCE(p_notes, '')), ''), 'spa_package', cp.payment_intent_id,
    0, w.therapist_id, w.room_id, p_user_id, CASE WHEN v_member IS NULL THEN 'non_member_portal' ELSE 'member_portal' END, z.id, p_visit_type, cp.id
  FROM public.spa_client_packages cp WHERE cp.id = p_client_package_id AND cp.user_id = p_user_id
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Treatment series not found.'); END IF;
  RETURN jsonb_build_object('ok', true, 'appointment', to_jsonb(a));
EXCEPTION WHEN raise_exception THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $function$;

-- Staff department lookup is only used inside the clock-in function.
REVOKE EXECUTE ON FUNCTION public._clock_department(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._clock_department(uuid) TO service_role;

-- Open front-desk shifts list is not used by the app; keep it server-only.
REVOKE EXECUTE ON FUNCTION public.frontdesk_open_shifts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.frontdesk_open_shifts() TO service_role;

-- Payment-plan schedule builders are only called by server code and other database functions.
REVOKE EXECUTE ON FUNCTION public.pt_build_plan_schedule(uuid, uuid, integer, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_build_plan_schedule(uuid, uuid, integer, date, date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pt_build_plan_schedule_v2(uuid, uuid, integer, date, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_build_plan_schedule_v2(uuid, uuid, integer, date, date, integer) TO service_role;

-- Monthly membership credits are granted only by the payment webhook.
REVOKE EXECUTE ON FUNCTION public.grant_monthly_membership_credit(uuid, uuid, text, text, public.credit_type, integer, date, date, timestamptz, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_membership_credit(uuid, uuid, text, text, public.credit_type, integer, date, date, timestamptz, text, jsonb) TO service_role;

-- Pay-period refresh is staff/server only.
REVOKE EXECUTE ON FUNCTION public.refresh_instructor_pay_period(uuid) FROM PUBLIC, anon;

-- Café cash credit: staff can never grant credit to their own member account.
CREATE OR REPLACE FUNCTION public.grant_cafe_cash_credit(_member_id uuid, _amount_cents integer, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF EXISTS (SELECT 1 FROM public.members m WHERE m.id = _member_id AND m.user_id = auth.uid())
     AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'You cannot add café credit to your own account';
  END IF;

  INSERT INTO cafe_credit_ledger(member_id, kind, amount_cents, reason, created_by)
  VALUES (_member_id, 'cash_grant', _amount_cents, _reason, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- Gift class packs are no longer handed out just because a new account uses the same email.
-- Recipients claim them on the claim page instead.
CREATE OR REPLACE FUNCTION public.auto_claim_mothers_day_packs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally does nothing: an email address alone does not prove who owns an account.
  RETURN NEW;
END;
$function$;

-- Instructor portal access is granted only by an admin (Grant portal access), never by an email match at sign-up.
CREATE OR REPLACE FUNCTION public.link_instructor_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally does nothing: admins grant instructor access with admin_grant_instructor_portal.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_instructor_on_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally does nothing: admins grant instructor access with admin_grant_instructor_portal.
  RETURN NEW;
END;
$function$;

-- Scheduled text campaigns: the one-time timer proves itself with the vault-held internal task token.
CREATE OR REPLACE FUNCTION public.arm_sms_campaign(_id uuid, _send_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t timestamptz := _send_at AT TIME ZONE 'UTC';
BEGIN
  PERFORM cron.schedule('sms-camp-' || _id::text,
    format('%s %s %s %s *', extract(minute from t)::int, extract(hour from t)::int, extract(day from t)::int, extract(month from t)::int),
    $c$select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/run-sms-campaign-scheduled',
      headers:=replace('{"Content-Type": "application/json", "x-internal-token": "__T__"}','__T__',public.internal_task_token())::jsonb,
      body:='{}'::jsonb, timeout_milliseconds:=300000);$c$);
END $function$;

-- Billing balances: staff cannot change balance rows on their own member account (super admins excepted).
CREATE OR REPLACE FUNCTION public.guard_own_billing_arrears()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_member uuid := COALESCE(NEW.member_id, OLD.member_id);
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = v_member AND m.user_id = auth.uid())
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'You cannot change billing balances on your own account' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_billing_arrears_guard_own ON public.billing_arrears;
CREATE TRIGGER trg_billing_arrears_guard_own
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_arrears
  FOR EACH ROW EXECUTE FUNCTION public.guard_own_billing_arrears();