-- RPC function to check for spa appointment conflicts
CREATE OR REPLACE FUNCTION public.check_spa_appointment_conflict(
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_duration_minutes INTEGER,
  p_cleanup_minutes INTEGER DEFAULT 15,
  p_staff_id UUID DEFAULT NULL,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(has_conflict BOOLEAN, conflicting_appointment_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_start TIME := p_appointment_time;
  new_end TIME := p_appointment_time + (p_duration_minutes + p_cleanup_minutes) * INTERVAL '1 minute';
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_conflict,
    sa.id as conflicting_appointment_id
  FROM spa_appointments sa
  WHERE sa.appointment_date = p_appointment_date
    AND sa.status IN ('confirmed', 'pending')
    AND (p_exclude_appointment_id IS NULL OR sa.id != p_exclude_appointment_id)
    AND (p_staff_id IS NULL OR sa.staff_id = p_staff_id)
    AND (
      -- Check for time overlap
      (new_start < sa.appointment_time + (sa.duration_minutes + COALESCE(sa.cleanup_minutes, 15)) * INTERVAL '1 minute')
      AND
      (new_end > sa.appointment_time)
    )
  LIMIT 1;
END;
$$;

-- RPC function to check for duplicate check-ins
CREATE OR REPLACE FUNCTION public.check_for_duplicate_check_in(
  p_member_id UUID,
  p_check_in_window_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exists_recent_check_in BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM check_ins 
    WHERE member_id = p_member_id 
      AND checked_in_at >= NOW() - (p_check_in_window_minutes * INTERVAL '1 minute')
  ) INTO exists_recent_check_in;
  
  RETURN exists_recent_check_in;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_spa_appointment_conflict(DATE, TIME, INTEGER, INTEGER, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_for_duplicate_check_in(UUID, INTEGER) TO authenticated;