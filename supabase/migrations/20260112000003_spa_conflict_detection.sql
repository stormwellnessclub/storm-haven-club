-- Spa Appointment Conflict Detection Fix
-- Proper conflict detection for spa appointments that checks for time overlaps

-- Create function to check for spa appointment conflicts
CREATE OR REPLACE FUNCTION check_spa_appointment_conflict(
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_duration_minutes INTEGER,
  p_cleanup_minutes INTEGER DEFAULT 15,
  p_staff_id UUID DEFAULT NULL,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflicting_appointment_id UUID,
  conflicting_appointment_time TIME,
  conflicting_duration_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time_minutes INTEGER;
  v_end_time_minutes INTEGER;
  v_conflict_record RECORD;
  v_existing_start_minutes INTEGER;
  v_existing_end_minutes INTEGER;
BEGIN
  -- Convert appointment time to minutes since midnight for easier comparison
  v_start_time_minutes := EXTRACT(HOUR FROM p_appointment_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_appointment_time)::INTEGER;
  v_end_time_minutes := v_start_time_minutes + p_duration_minutes + p_cleanup_minutes;
  
  -- Check for overlapping appointments
  -- Two appointments overlap if their time ranges intersect
  FOR v_conflict_record IN
    SELECT 
      id,
      appointment_time,
      duration_minutes + COALESCE(cleanup_minutes, 15) AS total_duration
    FROM spa_appointments
    WHERE appointment_date = p_appointment_date
      AND status IN ('confirmed', 'pending')
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
      AND (
        -- Check if staff_id matches (if specified) or if no staff is assigned
        (p_staff_id IS NULL AND staff_id IS NULL) OR
        (p_staff_id IS NOT NULL AND staff_id = p_staff_id)
      )
  LOOP
    -- Convert existing appointment time to minutes since midnight
    v_existing_start_minutes := EXTRACT(HOUR FROM v_conflict_record.appointment_time)::INTEGER * 60 + EXTRACT(MINUTE FROM v_conflict_record.appointment_time)::INTEGER;
    v_existing_end_minutes := v_existing_start_minutes + v_conflict_record.total_duration;
    
    -- Check if time ranges overlap
    -- Two ranges overlap if: start1 < end2 AND start2 < end1
    IF v_start_time_minutes < v_existing_end_minutes AND v_existing_start_minutes < v_end_time_minutes THEN
      RETURN QUERY SELECT 
        TRUE,
        v_conflict_record.id,
        v_conflict_record.appointment_time,
        v_conflict_record.total_duration;
      RETURN; -- Exit function early
    END IF;
  END LOOP;
  
  -- No conflict found
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIME, NULL::INTEGER;
END;
$$;

GRANT EXECUTE ON FUNCTION check_spa_appointment_conflict TO authenticated;

-- Create index to improve conflict check performance
CREATE INDEX IF NOT EXISTS idx_spa_appointments_conflict_check 
ON spa_appointments(appointment_date, appointment_time, staff_id, status)
WHERE status IN ('confirmed', 'pending');
