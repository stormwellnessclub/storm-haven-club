
-- Replace the generate_class_sessions function with one that also reconciles
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
  
  -- STEP 1: Hide future sessions whose schedule is now inactive or whose class_type is inactive
  UPDATE class_sessions cs
  SET is_hidden = true, updated_at = now()
  WHERE cs.session_date >= _start_date
    AND cs.is_cancelled = false
    AND cs.is_hidden = false
    AND cs.schedule_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM class_schedules s WHERE s.id = cs.schedule_id AND s.is_active = false
      )
      OR EXISTS (
        SELECT 1 FROM class_types ct WHERE ct.id = cs.class_type_id AND ct.is_active = false
      )
    );
  GET DIAGNOSTICS _hidden = ROW_COUNT;

  -- STEP 2: Unhide future sessions whose schedule is active again
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

  -- STEP 3: Update future sessions to match their schedule's current details
  FOR _existing_session IN
    SELECT cs.id as session_id, cs.schedule_id, cs.start_time as sess_start, cs.end_time as sess_end,
           cs.instructor_id as sess_instructor, cs.room as sess_room, cs.max_capacity as sess_cap,
           cs.current_enrollment,
           s.start_time as sched_start, s.end_time as sched_end,
           s.instructor_id as sched_instructor, s.room as sched_room,
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
      )
  LOOP
    -- Only update if no bookings exist (to avoid breaking existing reservations)
    IF _existing_session.current_enrollment = 0 THEN
      UPDATE class_sessions
      SET start_time = _existing_session.sched_start,
          end_time = _existing_session.sched_end,
          instructor_id = _existing_session.sched_instructor,
          room = _existing_session.sched_room,
          max_capacity = _existing_session.sched_cap,
          updated_at = now()
      WHERE id = _existing_session.session_id;
      _updated := _updated + 1;
    END IF;
  END LOOP;
  
  -- STEP 4: Generate new sessions from active schedules
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
          max_capacity, room, current_enrollment, is_cancelled, is_hidden
        ) VALUES (
          _schedule.schedule_id, _schedule.class_type_id, _schedule.instructor_id,
          _current_date, _schedule.start_time, _schedule.end_time,
          _schedule.max_capacity, _schedule.room, 0, false, false
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

-- Update the old function to call the new one for backwards compatibility
CREATE OR REPLACE FUNCTION public.generate_class_sessions(_start_date date DEFAULT CURRENT_DATE, _weeks_ahead integer DEFAULT 4)
 RETURNS TABLE(sessions_created integer, sessions_skipped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result RECORD;
BEGIN
  SELECT * INTO _result FROM reconcile_and_generate_class_sessions(_start_date, _weeks_ahead);
  RETURN QUERY SELECT _result.sessions_created, _result.sessions_skipped;
END;
$function$;
