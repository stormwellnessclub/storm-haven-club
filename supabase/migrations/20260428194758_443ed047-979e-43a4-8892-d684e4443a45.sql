CREATE OR REPLACE FUNCTION public.kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r.*) ORDER BY r.name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      cb.id AS booking_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(nmp.first_name, '') || ' ' || COALESCE(nmp.last_name, '')), ''),
        NULLIF(cb.walk_in_name, ''),
        CASE
          WHEN cb.walk_in_email IS NOT NULL AND cb.walk_in_email <> '' THEN 'Guest – ' || cb.walk_in_email
          WHEN p.email IS NOT NULL AND p.email <> '' THEN 'Guest – ' || p.email
          WHEN nmp.email IS NOT NULL AND nmp.email <> '' THEN 'Guest – ' || nmp.email
          ELSE 'Unknown'
        END
      ) AS name,
      cb.status,
      cb.checked_in_at,
      m.photo_url AS photo_url
    FROM class_bookings cb
    LEFT JOIN members m ON m.id = cb.member_id
    LEFT JOIN profiles p ON p.user_id = cb.user_id
    LEFT JOIN non_member_profiles nmp ON nmp.user_id = cb.user_id
    WHERE cb.session_id = p_session_id
      AND cb.status IN ('confirmed', 'completed')
  ) r;

  RETURN v_result;
END;
$function$;