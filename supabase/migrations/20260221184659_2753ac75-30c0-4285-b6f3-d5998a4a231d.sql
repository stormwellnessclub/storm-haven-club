
CREATE OR REPLACE FUNCTION public.find_or_create_temp_class_session(
  _class_name TEXT,
  _session_date DATE,
  _start_time TIME,
  _end_time TIME,
  _max_capacity INT DEFAULT 8
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _class_type_id UUID;
  _session_id UUID;
BEGIN
  -- Find the class type by name
  SELECT id INTO _class_type_id FROM public.class_types WHERE name = _class_name AND is_active = true LIMIT 1;
  
  -- If class type doesn't exist, create it
  IF _class_type_id IS NULL THEN
    INSERT INTO public.class_types (name, category, duration_minutes, max_capacity, is_active)
    VALUES (_class_name, 'pilates_cycling', 50, _max_capacity, true)
    RETURNING id INTO _class_type_id;
  END IF;
  
  -- Find existing session for this date/time/class
  SELECT id INTO _session_id FROM public.class_sessions 
  WHERE class_type_id = _class_type_id 
    AND session_date = _session_date 
    AND start_time = _start_time
    AND NOT is_cancelled
  LIMIT 1;
  
  -- Create if not found
  IF _session_id IS NULL THEN
    INSERT INTO public.class_sessions (class_type_id, session_date, start_time, end_time, max_capacity, current_enrollment)
    VALUES (_class_type_id, _session_date, _start_time, _end_time, _max_capacity, 0)
    RETURNING id INTO _session_id;
  END IF;
  
  RETURN _session_id;
END;
$$;
