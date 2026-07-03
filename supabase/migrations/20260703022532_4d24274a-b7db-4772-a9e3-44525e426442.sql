
-- 1. New columns
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS is_invite_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS is_invite_only boolean NOT NULL DEFAULT false;

-- 2. Block members from self-booking invite-only sessions
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
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  IF is_email_blocked(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your access has been revoked. Please contact the club.');
  END IF;

  SELECT * INTO _session_record FROM class_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  IF _session_record.is_invite_only THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class is invite only — please contact the front desk to be added to the roster.');
  END IF;

  IF _session_record.is_fundraiser THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is a fundraiser class. Class credits and passes cannot be used — please complete checkout to donate the full amount and reserve your spot.');
  END IF;

  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method. Please use class credits or a class pass.');
  END IF;

  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class credits specified. Please purchase a class pass.');
  END IF;

  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class pass specified. Please select a class pass.');
  END IF;

  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class has been cancelled');
  END IF;

  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class is full');
  END IF;

  SELECT * INTO _existing_booking FROM class_bookings WHERE session_id = _session_id AND user_id = _user_id AND status = 'confirmed';
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this class');
  END IF;

  SELECT id INTO _member_id FROM members WHERE user_id = _user_id AND status = 'active';

  IF _payment_method = 'credits' AND _member_id IS NOT NULL AND public.is_member_past_due(_member_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account past due — please update your payment method, or proceed at the drop-in rate.'
    );
  END IF;

  IF _payment_method = 'credits' AND _member_credit_id IS NOT NULL THEN
    SELECT * INTO _credit_record FROM member_credits WHERE id = _member_credit_id AND credits_remaining > 0 AND expires_at > NOW() FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available class credits');
    END IF;
    UPDATE member_credits SET credits_remaining = credits_remaining - 1 WHERE id = _member_credit_id;
  END IF;

  IF _payment_method = 'pass' AND _pass_id IS NOT NULL THEN
    SELECT * INTO _pass_record FROM class_passes WHERE id = _pass_id AND user_id = _user_id AND status = 'active' AND classes_remaining > 0 AND expires_at > NOW() FOR UPDATE;
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

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$function$;

-- 3. Update generator to propagate is_invite_only from schedule → session
CREATE OR REPLACE FUNCTION public.reconcile_and_generate_class_sessions(_start_date date DEFAULT CURRENT_DATE, _weeks_ahead integer DEFAULT 4)
 RETURNS TABLE(sessions_created integer, sessions_skipped integer, sessions_hidden integer, sessions_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _end_date date;
  _current_date date;
  _schedule RECORD;
  _created integer := 0;
  _skipped integer := 0;
  _hidden integer := 0;
  _updated integer := 0;
  _day_of_week integer;
  _existing_count integer;
  _existing_session RECORD;
BEGIN
  _end_date := _start_date + (_weeks_ahead * 7);

  UPDATE class_sessions cs
  SET is_hidden = true, updated_at = now()
  WHERE cs.session_date >= _start_date
    AND cs.is_cancelled = false
    AND cs.is_hidden = false
    AND cs.schedule_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM class_schedules s WHERE s.id = cs.schedule_id AND s.is_active = false)
      OR EXISTS (SELECT 1 FROM class_types ct WHERE ct.id = cs.class_type_id AND ct.is_active = false)
    );
  GET DIAGNOSTICS _hidden = ROW_COUNT;

  UPDATE class_sessions cs
  SET is_hidden = false, updated_at = now()
  WHERE cs.session_date >= _start_date
    AND cs.is_cancelled = false
    AND cs.is_hidden = true
    AND cs.schedule_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM class_schedules s
      JOIN class_types ct ON ct.id = s.class_type_id
      WHERE s.id = cs.schedule_id AND s.is_active = true AND ct.is_active = true
    );

  FOR _existing_session IN
    SELECT cs.id as session_id, cs.schedule_id, cs.start_time as sess_start, cs.end_time as sess_end,
           cs.instructor_id as sess_instructor, cs.room as sess_room, cs.max_capacity as sess_cap,
           cs.current_enrollment, cs.is_invite_only as sess_invite,
           s.start_time as sched_start, s.end_time as sched_end,
           s.instructor_id as sched_instructor, s.room as sched_room,
           s.is_invite_only as sched_invite,
           COALESCE(s.max_capacity, ct.max_capacity) as sched_cap
    FROM class_sessions cs
    JOIN class_schedules s ON s.id = cs.schedule_id
    JOIN class_types ct ON ct.id = s.class_type_id
    WHERE cs.session_date >= _start_date
      AND cs.is_cancelled = false
      AND s.is_active = true
      AND ct.is_active = true
      AND (
        cs.start_time != s.start_time
        OR cs.end_time != s.end_time
        OR cs.instructor_id IS DISTINCT FROM s.instructor_id
        OR cs.room IS DISTINCT FROM s.room
        OR cs.max_capacity != COALESCE(s.max_capacity, ct.max_capacity)
        OR cs.is_invite_only IS DISTINCT FROM s.is_invite_only
      )
  LOOP
    IF _existing_session.current_enrollment = 0 THEN
      UPDATE class_sessions
      SET start_time = _existing_session.sched_start,
          end_time = _existing_session.sched_end,
          instructor_id = _existing_session.sched_instructor,
          room = _existing_session.sched_room,
          max_capacity = _existing_session.sched_cap,
          is_invite_only = _existing_session.sched_invite,
          updated_at = now()
      WHERE id = _existing_session.session_id;
      _updated := _updated + 1;
    END IF;
  END LOOP;

  _current_date := _start_date;
  WHILE _current_date <= _end_date LOOP
    _day_of_week := EXTRACT(DOW FROM _current_date)::integer;

    FOR _schedule IN
      SELECT
        cs.id as schedule_id,
        cs.class_type_id,
        cs.instructor_id,
        cs.start_time,
        cs.end_time,
        cs.room,
        cs.is_invite_only,
        COALESCE(cs.max_capacity, ct.max_capacity) as max_capacity
      FROM class_schedules cs
      JOIN class_types ct ON cs.class_type_id = ct.id
      WHERE cs.is_active = true
        AND cs.day_of_week = _day_of_week
        AND ct.is_active = true
    LOOP
      SELECT COUNT(*) INTO _existing_count
      FROM class_sessions
      WHERE schedule_id = _schedule.schedule_id
        AND session_date = _current_date;

      IF _existing_count = 0 THEN
        INSERT INTO class_sessions (
          schedule_id, class_type_id, instructor_id,
          session_date, start_time, end_time,
          max_capacity, room, current_enrollment, is_cancelled, is_hidden, is_invite_only
        ) VALUES (
          _schedule.schedule_id, _schedule.class_type_id, _schedule.instructor_id,
          _current_date, _schedule.start_time, _schedule.end_time,
          _schedule.max_capacity, _schedule.room, 0, false, false, _schedule.is_invite_only
        );
        _created := _created + 1;
      ELSE
        _skipped := _skipped + 1;
      END IF;
    END LOOP;
    _current_date := _current_date + 1;
  END LOOP;

  RETURN QUERY SELECT _created, _skipped, _hidden, _updated;
END;
$function$;
