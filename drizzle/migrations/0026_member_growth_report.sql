CREATE OR REPLACE FUNCTION public.get_monthly_member_growth(
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE (
  month date,
  new_members integer,
  still_active integer,
  frozen integer,
  cancelled integer,
  legacy_backfilled integer,
  with_recorded_payment integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      m.id,
      m.status,
      m.activated_at,
      COALESCE((m.activated_at AT TIME ZONE 'America/Detroit')::date, m.membership_start_date) AS join_date
    FROM public.members m
    WHERE m.status <> 'pending_activation'
  ), filtered AS (
    SELECT b.*,
      EXISTS (
        SELECT 1 FROM public.payment_attempts p
        WHERE p.member_id = b.id AND p.status = 'succeeded'
      ) AS has_paid
    FROM base b
    WHERE b.join_date IS NOT NULL
      AND (_start_date IS NULL OR b.join_date >= _start_date)
      AND (_end_date IS NULL OR b.join_date <= _end_date)
  )
  SELECT
    date_trunc('month', f.join_date)::date AS month,
    COUNT(*)::integer AS new_members,
    COUNT(*) FILTER (WHERE f.status = 'active')::integer AS still_active,
    COUNT(*) FILTER (WHERE f.status = 'frozen')::integer AS frozen,
    COUNT(*) FILTER (WHERE f.status = 'cancelled')::integer AS cancelled,
    COUNT(*) FILTER (WHERE f.activated_at IS NULL)::integer AS legacy_backfilled,
    COUNT(*) FILTER (WHERE f.has_paid)::integer AS with_recorded_payment
  FROM filtered f
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_member_growth(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_member_growth(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_member_growth(date, date) TO service_role;