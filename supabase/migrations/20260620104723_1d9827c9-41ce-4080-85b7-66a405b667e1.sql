CREATE OR REPLACE FUNCTION public.mark_member_achievement_celebrated(_achievement_id uuid, _achievement_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  WITH upd AS (
    UPDATE public.member_achievements
    SET celebrated_at = now()
    WHERE id = _achievement_id
      AND user_id = v_uid
      AND achievement_type = _achievement_type
      AND celebrated_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_count FROM upd;

  RETURN COALESCE(v_count, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_member_achievement_celebrated(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_member_achievement_celebrated(uuid, text) TO service_role;