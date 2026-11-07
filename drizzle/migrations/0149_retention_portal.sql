CREATE TABLE public.retention_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'call',
  outcome text NOT NULL DEFAULT 'reached',
  note text,
  staff_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_outreach TO authenticated;
GRANT ALL ON public.retention_outreach TO service_role;
ALTER TABLE public.retention_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage retention outreach" ON public.retention_outreach
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE INDEX retention_outreach_member_idx ON public.retention_outreach(member_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_retention_visits(p_days integer DEFAULT 180)
RETURNS TABLE(member_id uuid, visit_day date, kind text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_since date := ((now() AT TIME ZONE 'America/Detroit')::date - LEAST(GREATEST(p_days,1),730));
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  WITH mem AS (SELECT m.id, m.user_id FROM members m WHERE m.status <> 'cancelled')
  SELECT DISTINCT x.mid, x.d, x.k FROM (
    SELECT c.member_id mid, (c.checked_in_at AT TIME ZONE 'America/Detroit')::date d, 'checkin'::text k
      FROM check_ins c JOIN mem ON mem.id = c.member_id
    UNION ALL
    SELECT mem.id, s.session_date, 'class'
      FROM class_bookings b JOIN class_sessions s ON s.id = b.session_id
      JOIN mem ON (mem.id = b.member_id OR (b.user_id IS NOT NULL AND mem.user_id = b.user_id))
      WHERE COALESCE(b.is_admin_hold,false) = false
        AND (b.checked_in_at IS NOT NULL OR b.status = 'completed')
    UNION ALL
    SELECT mem.id, (COALESCE(p.checked_in_at, p.completed_at, p.starts_at) AT TIME ZONE 'America/Detroit')::date, 'pt'
      FROM pt_appointments p JOIN mem ON mem.user_id = p.user_id
      WHERE p.checked_in_at IS NOT NULL OR p.status = 'completed'
    UNION ALL
    SELECT mem.id, a.appointment_date, 'spa'
      FROM spa_appointments a JOIN mem ON (mem.id = a.member_id OR (a.user_id IS NOT NULL AND mem.user_id = a.user_id))
      WHERE a.status = 'completed' OR a.checked_in_at IS NOT NULL
    UNION ALL
    SELECT u.member_id, (u.used_at AT TIME ZONE 'America/Detroit')::date, 'recovery'
      FROM amenity_usage_logs u JOIN mem ON mem.id = u.member_id
  ) x
  WHERE x.d >= v_since AND x.d <= (now() AT TIME ZONE 'America/Detroit')::date;
END $$;
REVOKE ALL ON FUNCTION public.admin_retention_visits(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_retention_visits(integer) TO authenticated;