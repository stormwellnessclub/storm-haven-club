
ALTER TABLE public.user_class_achievements
  ADD COLUMN IF NOT EXISTS celebrated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_uca_user_uncelebrated
  ON public.user_class_achievements(user_id, awarded_at DESC)
  WHERE celebrated_at IS NULL AND achievement_kind = 'lifetime_milestone';

-- Backfill: for each user, mark all lifetime_milestone rows as celebrated
-- EXCEPT the single highest milestone (their catch-up celebration).
WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY milestone DESC NULLS LAST, awarded_at DESC
    ) AS rn
  FROM public.user_class_achievements
  WHERE achievement_kind = 'lifetime_milestone'
    AND celebrated_at IS NULL
)
UPDATE public.user_class_achievements uca
SET celebrated_at = now()
FROM ranked r
WHERE uca.id = r.id
  AND r.rn > 1;

-- Returns this member's most recent unseen lifetime milestone, or null.
CREATE OR REPLACE FUNCTION public.get_pending_class_milestone()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT id, milestone, awarded_at, total_at_award
    INTO v_row
  FROM public.user_class_achievements
  WHERE user_id = v_uid
    AND achievement_kind = 'lifetime_milestone'
    AND celebrated_at IS NULL
  ORDER BY milestone DESC NULLS LAST, awarded_at DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'milestone', v_row.milestone,
    'awarded_at', v_row.awarded_at,
    'total_at_award', v_row.total_at_award
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_class_milestone() TO authenticated;

-- Marks ALL unseen lifetime_milestone rows for this user as celebrated.
-- Called when the member dismisses the overlay so lower milestones don't queue.
CREATE OR REPLACE FUNCTION public.mark_class_milestones_seen()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  WITH upd AS (
    UPDATE public.user_class_achievements
    SET celebrated_at = now()
    WHERE user_id = v_uid
      AND achievement_kind = 'lifetime_milestone'
      AND celebrated_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_class_milestones_seen() TO authenticated;
