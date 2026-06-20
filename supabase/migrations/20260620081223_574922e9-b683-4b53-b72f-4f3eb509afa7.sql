
-- 1. Track which achievements have been celebrated in the portal
ALTER TABLE public.member_achievements
  ADD COLUMN IF NOT EXISTS celebrated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_member_achievements_uncelebrated
  ON public.member_achievements (user_id) WHERE celebrated_at IS NULL;

-- 2. Backfill: award every achievement each member currently qualifies for
DO $$
DECLARE
  m_id uuid;
BEGIN
  FOR m_id IN SELECT id FROM public.members LOOP
    BEGIN
      PERFORM public.check_and_award_achievements(m_id);
    EXCEPTION WHEN OTHERS THEN
      -- never abort the whole backfill on one bad member
      NULL;
    END;
  END LOOP;
END$$;

-- 3. Mark all but the single highest-value (newest tiebreak) achievement
--    as already celebrated for each member, so existing members get exactly
--    ONE catch-up celebration on next portal visit.
WITH ranked AS (
  SELECT
    ma.id,
    ROW_NUMBER() OVER (
      PARTITION BY ma.user_id
      ORDER BY COALESCE(a.points_reward, 0) DESC, ma.earned_at DESC, ma.id DESC
    ) AS rn
  FROM public.member_achievements ma
  LEFT JOIN public.achievements a
    ON LOWER(a.name) = LOWER(ma.achievement_name)
  WHERE ma.celebrated_at IS NULL
)
UPDATE public.member_achievements ma
SET celebrated_at = now()
FROM ranked r
WHERE ma.id = r.id AND r.rn > 1;

-- 4. Trigger function: run the awarder for the affected member.
--    Resolves member_id from whatever source column the trigger row has.
CREATE OR REPLACE FUNCTION public.trg_auto_award_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_user_id uuid;
BEGIN
  -- Prefer member_id if the row has it
  BEGIN
    v_member_id := NEW.member_id;
  EXCEPTION WHEN undefined_column THEN
    v_member_id := NULL;
  END;

  -- Otherwise resolve via user_id -> members
  IF v_member_id IS NULL THEN
    BEGIN
      v_user_id := NEW.user_id;
    EXCEPTION WHEN undefined_column THEN
      v_user_id := NULL;
    END;
    IF v_user_id IS NOT NULL THEN
      SELECT id INTO v_member_id FROM public.members WHERE user_id = v_user_id LIMIT 1;
    END IF;
  END IF;

  -- habit_logs path: resolve via habit_id -> habits.member_id
  IF v_member_id IS NULL AND TG_TABLE_NAME = 'habit_logs' THEN
    SELECT h.member_id INTO v_member_id
    FROM public.habits h WHERE h.id = NEW.habit_id LIMIT 1;
  END IF;

  IF v_member_id IS NOT NULL THEN
    BEGIN
      PERFORM public.check_and_award_achievements(v_member_id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never block the source insert
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Attach triggers (idempotent: drop then create)
DROP TRIGGER IF EXISTS auto_award_after_check_in ON public.check_ins;
CREATE TRIGGER auto_award_after_check_in
  AFTER INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_workout_log ON public.workout_logs;
CREATE TRIGGER auto_award_after_workout_log
  AFTER INSERT ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_spa_appt ON public.spa_appointments;
CREATE TRIGGER auto_award_after_spa_appt
  AFTER INSERT OR UPDATE OF status ON public.spa_appointments
  FOR EACH ROW
  WHEN (NEW.status IN ('confirmed','completed'))
  EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_class_booking ON public.class_bookings;
CREATE TRIGGER auto_award_after_class_booking
  AFTER INSERT OR UPDATE OF status ON public.class_bookings
  FOR EACH ROW
  WHEN (NEW.status IN ('confirmed','completed'))
  EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_amenity_use ON public.amenity_usage_logs;
CREATE TRIGGER auto_award_after_amenity_use
  AFTER INSERT ON public.amenity_usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_habit_log ON public.habit_logs;
CREATE TRIGGER auto_award_after_habit_log
  AFTER INSERT ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_award_achievements();

DROP TRIGGER IF EXISTS auto_award_after_goal_update ON public.member_goals;
CREATE TRIGGER auto_award_after_goal_update
  AFTER UPDATE OF status ON public.member_goals
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
  EXECUTE FUNCTION public.trg_auto_award_achievements();
