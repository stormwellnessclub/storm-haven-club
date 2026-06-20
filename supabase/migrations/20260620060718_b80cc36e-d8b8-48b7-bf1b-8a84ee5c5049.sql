
CREATE TABLE IF NOT EXISTS public.user_class_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  milestone int,
  class_type_id uuid,
  achievement_kind text NOT NULL CHECK (achievement_kind IN ('lifetime_milestone','first_in_type')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  total_at_award int
);

CREATE UNIQUE INDEX IF NOT EXISTS user_class_achievements_unique
  ON public.user_class_achievements(user_id, achievement_kind, COALESCE(milestone,-1), COALESCE(class_type_id,'00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_uca_user ON public.user_class_achievements(user_id);

GRANT SELECT ON public.user_class_achievements TO authenticated;
GRANT ALL ON public.user_class_achievements TO service_role;

ALTER TABLE public.user_class_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own class achievements" ON public.user_class_achievements;
CREATE POLICY "Users view their own class achievements"
  ON public.user_class_achievements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff view all class achievements" ON public.user_class_achievements;
CREATE POLICY "Staff view all class achievements"
  ON public.user_class_achievements FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','class_instructor']::app_role[]));

DROP POLICY IF EXISTS "Service role manages class achievements" ON public.user_class_achievements;
CREATE POLICY "Service role manages class achievements"
  ON public.user_class_achievements FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.award_class_milestones(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_class_type_id uuid;
  v_total int;
  v_prior_in_type int;
  v_milestones int[] := ARRAY[1,5,10,25,50,100,200,500];
  v_m int;
BEGIN
  SELECT COALESCE(m.user_id, cb.user_id), cs.class_type_id
    INTO v_user_id, v_class_type_id
  FROM class_bookings cb
  JOIN class_sessions cs ON cs.id = cb.session_id
  LEFT JOIN members m ON m.id = cb.member_id
  WHERE cb.id = p_booking_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*)::int INTO v_total
  FROM class_bookings cb
  LEFT JOIN members m ON m.id = cb.member_id
  WHERE cb.status = 'completed'
    AND COALESCE(m.user_id, cb.user_id) = v_user_id;

  FOREACH v_m IN ARRAY v_milestones LOOP
    IF v_total >= v_m THEN
      INSERT INTO public.user_class_achievements(user_id, milestone, class_type_id, achievement_kind, total_at_award)
      VALUES (v_user_id, v_m, NULL, 'lifetime_milestone', v_total)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF v_class_type_id IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_prior_in_type
    FROM class_bookings cb
    JOIN class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN members m ON m.id = cb.member_id
    WHERE cb.status = 'completed'
      AND cs.class_type_id = v_class_type_id
      AND COALESCE(m.user_id, cb.user_id) = v_user_id;

    IF v_prior_in_type >= 1 THEN
      INSERT INTO public.user_class_achievements(user_id, milestone, class_type_id, achievement_kind, total_at_award)
      VALUES (v_user_id, NULL, v_class_type_id, 'first_in_type', v_prior_in_type)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_class_milestones(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_award_class_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.award_class_milestones(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_class_milestones_trigger ON public.class_bookings;
CREATE TRIGGER award_class_milestones_trigger
  AFTER UPDATE OF status ON public.class_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_class_milestones();

DO $$
DECLARE
  v_user uuid; v_total int; v_m int;
  v_milestones int[] := ARRAY[1,5,10,25,50,100,200,500];
  r record;
BEGIN
  FOR v_user, v_total IN
    SELECT COALESCE(m.user_id, cb.user_id), COUNT(*)::int
    FROM class_bookings cb
    LEFT JOIN members m ON m.id = cb.member_id
    WHERE cb.status='completed' AND COALESCE(m.user_id, cb.user_id) IS NOT NULL
    GROUP BY 1
  LOOP
    FOREACH v_m IN ARRAY v_milestones LOOP
      IF v_total >= v_m THEN
        INSERT INTO public.user_class_achievements(user_id,milestone,class_type_id,achievement_kind,total_at_award)
        VALUES (v_user, v_m, NULL, 'lifetime_milestone', v_total)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT COALESCE(m.user_id, cb.user_id) AS uid, cs.class_type_id AS ctid, COUNT(*)::int AS total
    FROM class_bookings cb
    JOIN class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN members m ON m.id = cb.member_id
    WHERE cb.status='completed' AND COALESCE(m.user_id, cb.user_id) IS NOT NULL AND cs.class_type_id IS NOT NULL
    GROUP BY 1,2
  LOOP
    INSERT INTO public.user_class_achievements(user_id,milestone,class_type_id,achievement_kind,total_at_award)
    VALUES (r.uid, NULL, r.ctid, 'first_in_type', r.total)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
