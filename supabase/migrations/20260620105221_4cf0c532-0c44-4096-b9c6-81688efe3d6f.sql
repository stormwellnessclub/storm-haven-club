UPDATE public.user_class_achievements
SET celebrated_at = COALESCE(celebrated_at, now())
WHERE achievement_kind = 'lifetime_milestone'
  AND celebrated_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_pending_class_milestone()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  WITH next_row AS (
    SELECT id
    FROM public.user_class_achievements
    WHERE user_id = v_uid
      AND achievement_kind = 'lifetime_milestone'
      AND celebrated_at IS NULL
    ORDER BY milestone DESC NULLS LAST, awarded_at DESC
    LIMIT 1
  ), consumed AS (
    UPDATE public.user_class_achievements uca
    SET celebrated_at = now()
    FROM next_row nr
    WHERE uca.id = nr.id
    RETURNING uca.id, uca.milestone, uca.awarded_at, uca.total_at_award
  )
  SELECT id, milestone, awarded_at, total_at_award
  INTO v_row
  FROM consumed;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'milestone', v_row.milestone,
    'awarded_at', v_row.awarded_at,
    'total_at_award', v_row.total_at_award
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pending_class_milestone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_class_milestone() TO service_role;