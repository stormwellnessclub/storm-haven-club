-- Create function to generate class sessions from recurring schedules
CREATE OR REPLACE FUNCTION generate_class_sessions(
  _start_date date DEFAULT CURRENT_DATE,
  _weeks_ahead integer DEFAULT 4
)
RETURNS TABLE(sessions_created integer, sessions_skipped integer) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _end_date date;
  _current_date date;
  _schedule RECORD;
  _created integer := 0;
  _skipped integer := 0;
  _day_of_week integer;
  _existing_count integer;
BEGIN
  _end_date := _start_date + (_weeks_ahead * 7);
  
  -- Loop through each day in the range
  _current_date := _start_date;
  WHILE _current_date <= _end_date LOOP
    _day_of_week := EXTRACT(DOW FROM _current_date)::integer;
    
    -- Find all active schedules for this day of week
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
      -- Check if session already exists for this schedule on this date
      SELECT COUNT(*) INTO _existing_count
      FROM class_sessions
      WHERE schedule_id = _schedule.schedule_id
        AND session_date = _current_date;
      
      IF _existing_count = 0 THEN
        -- Create the session
        INSERT INTO class_sessions (
          schedule_id,
          class_type_id,
          instructor_id,
          session_date,
          start_time,
          end_time,
          max_capacity,
          room,
          current_enrollment,
          is_cancelled
        ) VALUES (
          _schedule.schedule_id,
          _schedule.class_type_id,
          _schedule.instructor_id,
          _current_date,
          _schedule.start_time,
          _schedule.end_time,
          _schedule.max_capacity,
          _schedule.room,
          0,
          false
        );
        _created := _created + 1;
      ELSE
        _skipped := _skipped + 1;
      END IF;
    END LOOP;
    
    _current_date := _current_date + 1;
  END LOOP;
  
  RETURN QUERY SELECT _created, _skipped;
END;
$$;

-- Grant execute permission to authenticated users (staff will use this)
GRANT EXECUTE ON FUNCTION generate_class_sessions(date, integer) TO authenticated;