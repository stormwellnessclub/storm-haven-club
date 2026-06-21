CREATE OR REPLACE FUNCTION public.kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_class_type_id uuid;
  v_class_type_name text;
  v_milestones int[] := ARRAY[1,5,10,25,50,100,200,500];
BEGIN
  SELECT cs.class_type_id, ct.name
    INTO v_class_type_id, v_class_type_name
  FROM class_sessions cs
  JOIN class_types ct ON ct.id = cs.class_type_id
  WHERE cs.id = p_session_id;

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
      m.photo_url AS photo_url,
      v_class_type_name AS class_type_name,
      (
        SELECT COUNT(*)::int
        FROM class_bookings pcb
        JOIN class_sessions pcs ON pcs.id = pcb.session_id
        WHERE (pcb.status = 'completed' OR pcb.checked_in_at IS NOT NULL)
          AND pcb.id <> cb.id
          AND pcs.class_type_id = v_class_type_id
          AND (
            (cb.member_id IS NOT NULL AND pcb.member_id = cb.member_id)
            OR (cb.member_id IS NULL AND cb.user_id IS NOT NULL AND pcb.user_id = cb.user_id)
          )
      ) AS prior_in_type,
      (
        SELECT COUNT(*)::int
        FROM class_bookings tcb
        WHERE (tcb.status = 'completed' OR tcb.checked_in_at IS NOT NULL)
          AND tcb.id <> cb.id
          AND (
            (cb.member_id IS NOT NULL AND tcb.member_id = cb.member_id)
            OR (cb.member_id IS NULL AND cb.user_id IS NOT NULL AND tcb.user_id = cb.user_id)
          )
      ) AS prior_total
    FROM class_bookings cb
    LEFT JOIN members m ON m.id = cb.member_id
    LEFT JOIN profiles p ON p.user_id = cb.user_id
    LEFT JOIN non_member_profiles nmp ON nmp.user_id = cb.user_id
    WHERE cb.session_id = p_session_id
      AND cb.status IN ('confirmed', 'completed')
  ) r;

  SELECT coalesce(jsonb_agg(
    elem
    || jsonb_build_object(
      'is_first_in_type', ((elem->>'prior_in_type')::int = 0),
      'is_first_visit',   ((elem->>'prior_total')::int = 0),
      'total_classes',    ((elem->>'prior_total')::int + 1),
      'milestone_hit',    (((elem->>'prior_total')::int + 1) = ANY(v_milestones)),
      'next_milestone', (
        SELECT MIN(mv) FROM unnest(v_milestones) AS mv
        WHERE mv > (elem->>'prior_total')::int
      )
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM jsonb_array_elements(v_result) AS elem;

  RETURN v_result;
END;
$function$;