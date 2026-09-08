CREATE OR REPLACE FUNCTION public.get_spa_busy_slots(p_date date)
RETURNS TABLE (
  appointment_time time,
  duration_minutes integer,
  cleanup_minutes integer,
  staff_id uuid,
  room_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.appointment_time,
         COALESCE(a.duration_minutes, 0),
         COALESCE(a.cleanup_minutes, 0),
         a.staff_id,
         a.room_id
  FROM public.spa_appointments a
  WHERE a.appointment_date = p_date
    AND a.status IN ('confirmed', 'pending', 'checked_in', 'in_progress');
$$;

REVOKE ALL ON FUNCTION public.get_spa_busy_slots(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_spa_busy_slots(date) TO anon, authenticated, service_role;