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
  IF auth.role() = 'authenticated'
     AND NOT public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role]) THEN
    RAISE EXCEPTION 'Not authorized to generate class sessions';
  END IF;

  _end_date := _start_date + (_weeks_ahead * 7);

  UPDATE class_schedules
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND effective_until IS NOT NULL
    AND effective_until < LEAST(_start_date, CURRENT_DATE);

  UPDATE class_sessions cs
  SET is_hidden = true, updated_at = now()
  WHERE cs.session_date >= _start_date
    AND cs.is_cancelled = false
    AND cs.is_hidden = false
    AND cs.schedule_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM class_schedules s
        WHERE s.id = cs.schedule_id
          AND (
            s.is_active = false
            OR (s.effective_from IS NOT NULL AND cs.session_date < s.effective_from)
            OR (s.effective_until IS NOT NULL AND cs.session_date > s.effective_until)
            OR (s.is_one_time = true AND cs.session_date IS DISTINCT FROM COALESCE(s.effective_from, s.effective_until))
          )
      )
      OR EXISTS (SELECT 1 FROM class_types ct WHERE ct.id = cs.class_type_id AND ct.is_active = false)
    )
    AND NOT EXISTS (
      SELECT 1 FROM class_bookings cb
      WHERE cb.session_id = cs.id AND cb.status = 'confirmed'
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
      WHERE s.id = cs.schedule_id
        AND s.is_active = true
        AND ct.is_active = true
        AND (s.effective_from IS NULL OR cs.session_date >= s.effective_from)
        AND (s.effective_until IS NULL OR cs.session_date <= s.effective_until)
        AND (s.is_one_time = false OR cs.session_date = COALESCE(s.effective_from, s.effective_until))
    );

  FOR _existing_session IN
    SELECT cs.id AS session_id, cs.start_time AS sess_start, cs.end_time AS sess_end,
           cs.instructor_id AS sess_instructor, cs.room AS sess_room, cs.max_capacity AS sess_cap,
           cs.current_enrollment, cs.is_invite_only AS sess_invite,
           s.start_time AS sched_start, s.end_time AS sched_end,
           s.instructor_id AS sched_instructor, s.room AS sched_room,
           s.is_invite_only AS sched_invite,
           COALESCE(s.max_capacity, ct.max_capacity) AS sched_cap
    FROM class_sessions cs
    JOIN class_schedules s ON s.id = cs.schedule_id
    JOIN class_types ct ON ct.id = s.class_type_id
    WHERE cs.session_date >= _start_date
      AND cs.is_cancelled = false
      AND s.is_active = true
      AND ct.is_active = true
      AND (s.effective_from IS NULL OR cs.session_date >= s.effective_from)
      AND (s.effective_until IS NULL OR cs.session_date <= s.effective_until)
      AND (s.is_one_time = false OR cs.session_date = COALESCE(s.effective_from, s.effective_until))
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
      SELECT cs.id AS schedule_id, cs.class_type_id, cs.instructor_id, cs.start_time,
             cs.end_time, cs.room, cs.is_invite_only, cs.is_one_time,
             cs.effective_from, cs.effective_until,
             COALESCE(cs.max_capacity, ct.max_capacity) AS max_capacity
      FROM class_schedules cs
      JOIN class_types ct ON cs.class_type_id = ct.id
      WHERE cs.is_active = true
        AND cs.day_of_week = _day_of_week
        AND ct.is_active = true
        AND (cs.effective_from IS NULL OR cs.effective_from <= _current_date)
        AND (cs.effective_until IS NULL OR cs.effective_until >= _current_date)
        AND (cs.is_one_time = false OR _current_date = COALESCE(cs.effective_from, cs.effective_until))
    LOOP
      SELECT COUNT(*) INTO _existing_count
      FROM class_sessions
      WHERE schedule_id = _schedule.schedule_id
        AND session_date = _current_date;

      IF _existing_count = 0 THEN
        INSERT INTO class_sessions (
          schedule_id, class_type_id, instructor_id, session_date, start_time, end_time,
          max_capacity, room, current_enrollment, is_cancelled, is_hidden, is_invite_only
        ) VALUES (
          _schedule.schedule_id, _schedule.class_type_id, _schedule.instructor_id,
          _current_date, _schedule.start_time, _schedule.end_time,
          _schedule.max_capacity, _schedule.room, 0, false, false, _schedule.is_invite_only
        )
        ON CONFLICT (class_type_id, session_date, start_time) DO UPDATE
        SET schedule_id = EXCLUDED.schedule_id,
            instructor_id = EXCLUDED.instructor_id,
            end_time = EXCLUDED.end_time,
            room = EXCLUDED.room,
            max_capacity = CASE WHEN class_sessions.current_enrollment = 0 THEN EXCLUDED.max_capacity ELSE class_sessions.max_capacity END,
            is_invite_only = EXCLUDED.is_invite_only,
            is_hidden = false,
            is_cancelled = false,
            updated_at = now();
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