CREATE OR REPLACE FUNCTION public.effective_waiver_status(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  status text,
  source text,
  signed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (SELECT unnest(_user_ids) AS user_id),
  nmp AS (
    SELECT n.user_id, n.waiver_signed, n.waiver_signed_at
    FROM non_member_profiles n WHERE n.user_id = ANY(_user_ids)
  ),
  first_booking AS (
    SELECT cb.user_id, MIN(cb.created_at) AS ts
    FROM class_bookings cb
    WHERE cb.user_id = ANY(_user_ids)
      AND cb.status IN ('confirmed','completed','no_show')
    GROUP BY cb.user_id
  ),
  first_pass AS (
    SELECT cp.user_id, MIN(cp.created_at) AS ts
    FROM class_passes cp
    WHERE cp.user_id = ANY(_user_ids)
      AND cp.status IN ('active','exhausted','expired')
    GROUP BY cp.user_id
  )
  SELECT
    i.user_id,
    CASE
      WHEN nmp.waiver_signed IS TRUE THEN 'signed'
      WHEN fb.ts IS NOT NULL THEN 'signed'
      WHEN fp.ts IS NOT NULL THEN 'signed'
      ELSE 'unsigned'
    END::text AS status,
    CASE
      WHEN nmp.waiver_signed IS TRUE THEN 'explicit'
      WHEN fb.ts IS NOT NULL THEN 'inferred_booking'
      WHEN fp.ts IS NOT NULL THEN 'inferred_pass'
      ELSE 'none'
    END::text AS source,
    COALESCE(nmp.waiver_signed_at, fb.ts, fp.ts) AS signed_at
  FROM ids i
  LEFT JOIN nmp ON nmp.user_id = i.user_id
  LEFT JOIN first_booking fb ON fb.user_id = i.user_id
  LEFT JOIN first_pass fp ON fp.user_id = i.user_id
$$;

REVOKE ALL ON FUNCTION public.effective_waiver_status(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_waiver_status(uuid[]) TO authenticated, service_role;

WITH proof AS (
  SELECT
    n.user_id,
    LEAST(
      COALESCE((SELECT MIN(cb.created_at) FROM class_bookings cb
                 WHERE cb.user_id = n.user_id
                   AND cb.status IN ('confirmed','completed','no_show')), 'infinity'::timestamptz),
      COALESCE((SELECT MIN(cp.created_at) FROM class_passes cp
                 WHERE cp.user_id = n.user_id
                   AND cp.status IN ('active','exhausted','expired')), 'infinity'::timestamptz)
    ) AS earliest_ts
  FROM non_member_profiles n
  WHERE n.waiver_signed IS NOT TRUE
)
UPDATE non_member_profiles nmp
SET waiver_signed = TRUE,
    waiver_signed_at = COALESCE(nmp.waiver_signed_at, proof.earliest_ts)
FROM proof
WHERE nmp.user_id = proof.user_id
  AND proof.earliest_ts <> 'infinity'::timestamptz;
