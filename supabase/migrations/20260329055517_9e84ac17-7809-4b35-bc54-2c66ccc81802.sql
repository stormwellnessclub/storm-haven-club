
CREATE OR REPLACE FUNCTION kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r.*) ORDER BY r.name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      cb.id AS booking_id,
      COALESCE(
        m.first_name || ' ' || m.last_name,
        cb.walk_in_name,
        'Unknown'
      ) AS name,
      cb.status,
      cb.checked_in_at,
      m.photo_url
    FROM class_bookings cb
    LEFT JOIN members m ON m.id = cb.member_id
    WHERE cb.session_id = p_session_id
      AND cb.status IN ('confirmed', 'checked_in')
    ORDER BY COALESCE(m.first_name || ' ' || m.last_name, cb.walk_in_name, 'Unknown')
  ) r;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_class_roster(uuid) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_class_roster(uuid) TO authenticated;
