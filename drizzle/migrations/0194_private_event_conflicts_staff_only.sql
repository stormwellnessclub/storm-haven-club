CREATE OR REPLACE FUNCTION public.private_event_conflicts(p_date date, p_start time without time zone, p_end time without time zone, p_exclude_event uuid DEFAULT NULL::uuid)
 RETURNS TABLE(source text, label text, start_time time without time zone, end_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) AS ok
  )
  SELECT 'class'::text,
         COALESCE(ct.name, 'Class') || COALESCE(' — ' || cs.room, ''),
         cs.start_time,
         cs.end_time
  FROM public.class_sessions cs
  LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
  WHERE (SELECT ok FROM allowed)
    AND cs.session_date = p_date
    AND COALESCE(cs.is_cancelled, false) = false
    AND cs.start_time < p_end
    AND COALESCE(cs.end_time, cs.start_time) > p_start
  UNION ALL
  SELECT 'spa'::text,
         'Spa appointment',
         a.appointment_time,
         (a.appointment_time + make_interval(mins => COALESCE(a.duration_minutes, 0)))::time
  FROM public.spa_appointments a
  WHERE (SELECT ok FROM allowed)
    AND a.appointment_date = p_date
    AND a.status IN ('confirmed','pending','checked_in','in_progress')
    AND a.appointment_time < p_end
    AND (a.appointment_time + make_interval(mins => COALESCE(a.duration_minutes, 0)))::time > p_start
  UNION ALL
  SELECT 'private_event'::text,
         COALESCE(e.title, 'Private event') || COALESCE(' — ' || b.space, ''),
         b.start_time,
         b.end_time
  FROM public.private_event_blocks b
  JOIN public.private_events e ON e.id = b.event_id
  WHERE (SELECT ok FROM allowed)
    AND b.block_date = p_date
    AND (p_exclude_event IS NULL OR b.event_id <> p_exclude_event)
    AND b.start_time < p_end
    AND b.end_time > p_start;
$function$;

REVOKE EXECUTE ON FUNCTION public.private_event_conflicts(date, time, time, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.private_event_conflicts(date, time, time, uuid) TO authenticated, service_role;