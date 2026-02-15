
CREATE OR REPLACE FUNCTION public.calculate_health_score(_member_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_score integer := 50;
  v_workout_count integer;
  v_checkin_count integer;
BEGIN
  -- Workouts in last 30 days
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs
  WHERE member_id = _member_id AND logged_at > now() - interval '30 days';
  v_score := v_score + LEAST(v_workout_count * 3, 30);

  -- Check-ins in last 30 days
  SELECT COUNT(*) INTO v_checkin_count FROM check_ins
  WHERE member_id = _member_id AND checked_in_at > now() - interval '30 days';
  v_score := v_score + LEAST(v_checkin_count * 2, 20);

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$;
