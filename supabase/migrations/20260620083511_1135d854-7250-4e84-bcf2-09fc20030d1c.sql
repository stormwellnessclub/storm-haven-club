
-- 1. Update achievements catalog
UPDATE public.achievements SET name = 'Arrival',          description = 'Your first class.'                       WHERE LOWER(name) = 'first check-in';
UPDATE public.achievements SET name = 'One Hundred',      description = 'One hundred classes.'                     WHERE LOWER(name) = 'century club';
UPDATE public.achievements SET name = 'A Full Month',     description = 'Thirty days. Thirty classes.'             WHERE LOWER(name) = 'month master';
UPDATE public.achievements SET name = 'Seven Days',       description = 'Seven, consecutive.'                      WHERE LOWER(name) = 'week warrior';
UPDATE public.achievements SET name = 'At Dawn',          description = 'Before seven.'                            WHERE LOWER(name) = 'early bird';
UPDATE public.achievements SET name = 'At Dusk',          description = 'After eight.'                             WHERE LOWER(name) = 'night owl';
UPDATE public.achievements SET name = 'Twenty-Five',      description = 'Twenty-five workouts.'                    WHERE LOWER(name) = 'fitness fanatic';
UPDATE public.achievements SET name = 'Recovery',         description = 'Five spa appointments.'                   WHERE LOWER(name) = 'spa enthusiast';
UPDATE public.achievements SET name = 'Range',            description = 'Five disciplines.'                        WHERE LOWER(name) = 'class explorer';
UPDATE public.achievements SET name = 'The Whole Club',   description = 'Five amenities.'                          WHERE LOWER(name) = 'wellness warrior';
UPDATE public.achievements SET name = 'Introduction',     description = 'You brought someone in.'                  WHERE LOWER(name) = 'social butterfly';
UPDATE public.achievements SET name = 'Goal, Met',        description = 'A goal completed.'                        WHERE LOWER(name) = 'goal crusher';
UPDATE public.achievements SET name = 'Thirty Days',      description = 'A habit, held.'                           WHERE LOWER(name) = 'habit hero';
UPDATE public.achievements SET name = 'A Full Week',      description = 'Seven days. Every habit kept.'            WHERE LOWER(name) = 'perfect week';
UPDATE public.achievements SET name = 'Founding Member',  description = 'Here from the beginning.'                 WHERE LOWER(name) = 'founding member';

-- 2. Retro-rename already-awarded rows so the Achievements page + overlays reflect new copy
UPDATE public.member_achievements SET achievement_name = 'Arrival',         description = 'Your first class.'             WHERE achievement_type = 'first_check_in';
UPDATE public.member_achievements SET achievement_name = 'One Hundred',     description = 'One hundred classes.'          WHERE achievement_type = 'century_club';
UPDATE public.member_achievements SET achievement_name = 'A Full Month',    description = 'Thirty days. Thirty classes.'  WHERE achievement_type = 'month_master';
UPDATE public.member_achievements SET achievement_name = 'Seven Days',      description = 'Seven, consecutive.'           WHERE achievement_type = 'week_warrior';
UPDATE public.member_achievements SET achievement_name = 'At Dawn',         description = 'Before seven.'                 WHERE achievement_type = 'early_bird';
UPDATE public.member_achievements SET achievement_name = 'At Dusk',         description = 'After eight.'                  WHERE achievement_type = 'night_owl';
UPDATE public.member_achievements SET achievement_name = 'Twenty-Five',     description = 'Twenty-five workouts.'         WHERE achievement_type = 'fitness_fanatic';
UPDATE public.member_achievements SET achievement_name = 'Recovery',        description = 'Five spa appointments.'        WHERE achievement_type = 'spa_enthusiast';
UPDATE public.member_achievements SET achievement_name = 'Range',           description = 'Five disciplines.'             WHERE achievement_type = 'class_explorer';
UPDATE public.member_achievements SET achievement_name = 'The Whole Club',  description = 'Five amenities.'               WHERE achievement_type = 'wellness_warrior';
UPDATE public.member_achievements SET achievement_name = 'Introduction',    description = 'You brought someone in.'       WHERE achievement_type = 'social_butterfly';
UPDATE public.member_achievements SET achievement_name = 'Goal, Met',       description = 'A goal completed.'             WHERE achievement_type = 'goal_crusher';
UPDATE public.member_achievements SET achievement_name = 'Thirty Days',     description = 'A habit, held.'                WHERE achievement_type = 'habit_hero';
UPDATE public.member_achievements SET achievement_name = 'A Full Week',     description = 'Seven days. Every habit kept.' WHERE achievement_type = 'perfect_week';
UPDATE public.member_achievements SET achievement_name = 'Founding Member', description = 'Here from the beginning.'      WHERE achievement_type = 'founding_member';

-- 3. Patch awarder function literals (logic unchanged)
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_check_in_count integer;
  v_check_in_30d integer;
  v_workout_count integer;
  v_spa_count integer;
  v_class_variety integer;
  v_amenity_variety integer;
  v_has_early_bird boolean;
  v_has_night_owl boolean;
  v_max_streak integer;
  v_has_completed_goal boolean;
  v_has_habit_streak_30 boolean;
  v_has_perfect_week boolean;
  v_is_founding boolean;
BEGIN
  SELECT user_id INTO v_user_id FROM members WHERE id = _member_id;
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_check_in_count FROM check_ins WHERE member_id = _member_id;
  SELECT COUNT(*) INTO v_check_in_30d FROM check_ins
    WHERE member_id = _member_id AND checked_in_at > now() - interval '30 days';
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs WHERE member_id = _member_id;
  SELECT COUNT(*) INTO v_spa_count FROM spa_appointments
    WHERE member_id = _member_id AND status IN ('confirmed', 'completed');
  SELECT COUNT(DISTINCT cs.class_type_id) INTO v_class_variety
    FROM class_bookings cb
    JOIN class_sessions cs ON cs.id = cb.session_id
    WHERE cb.user_id = v_user_id AND cb.status IN ('confirmed', 'completed');
  SELECT COUNT(DISTINCT amenity_type) INTO v_amenity_variety
    FROM amenity_usage_logs WHERE member_id = _member_id;
  SELECT EXISTS(SELECT 1 FROM check_ins WHERE member_id = _member_id AND EXTRACT(HOUR FROM checked_in_at) < 7) INTO v_has_early_bird;
  SELECT EXISTS(SELECT 1 FROM check_ins WHERE member_id = _member_id AND EXTRACT(HOUR FROM checked_in_at) >= 20) INTO v_has_night_owl;

  WITH check_in_days AS (
    SELECT DISTINCT checked_in_at::date AS d FROM check_ins WHERE member_id = _member_id
  ),
  grouped AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM check_in_days
  ),
  streaks AS (SELECT COUNT(*) AS streak_len FROM grouped GROUP BY grp)
  SELECT COALESCE(MAX(streak_len), 0) INTO v_max_streak FROM streaks;

  SELECT EXISTS(SELECT 1 FROM member_goals WHERE member_id = _member_id AND status = 'completed') INTO v_has_completed_goal;
  SELECT EXISTS(SELECT 1 FROM habit_streaks WHERE member_id = _member_id AND current_streak >= 30) INTO v_has_habit_streak_30;

  WITH habit_days AS (
    SELECT DISTINCT logged_date AS d FROM habit_logs
    WHERE habit_id IN (SELECT id FROM habits WHERE member_id = _member_id)
  ),
  grouped AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM habit_days
  ),
  streaks AS (SELECT COUNT(*) AS streak_len FROM grouped GROUP BY grp)
  SELECT EXISTS(SELECT 1 FROM streaks WHERE streak_len >= 7) INTO v_has_perfect_week;

  SELECT COALESCE(is_founding_member, false) INTO v_is_founding FROM members WHERE id = _member_id;

  IF v_check_in_count >= 1 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'first_check_in') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'first_check_in', 'Arrival', 'Your first class.');
  END IF;

  IF v_check_in_count >= 100 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'century_club') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'century_club', 'One Hundred', 'One hundred classes.');
  END IF;

  IF v_check_in_30d >= 30 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'month_master') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'month_master', 'A Full Month', 'Thirty days. Thirty classes.');
  END IF;

  IF v_has_early_bird AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'early_bird') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'early_bird', 'At Dawn', 'Before seven.');
  END IF;

  IF v_has_night_owl AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'night_owl') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'night_owl', 'At Dusk', 'After eight.');
  END IF;

  IF v_max_streak >= 7 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'week_warrior') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'week_warrior', 'Seven Days', 'Seven, consecutive.');
  END IF;

  IF v_workout_count >= 50 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'fitness_fanatic') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'fitness_fanatic', 'Twenty-Five', 'Twenty-five workouts.');
  END IF;

  IF v_spa_count >= 10 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'spa_enthusiast') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'spa_enthusiast', 'Recovery', 'Five spa appointments.');
  END IF;

  IF v_class_variety >= 5 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'class_explorer') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'class_explorer', 'Range', 'Five disciplines.');
  END IF;

  IF v_amenity_variety >= 6 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'wellness_warrior') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'wellness_warrior', 'The Whole Club', 'Five amenities.');
  END IF;

  IF v_has_completed_goal AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'goal_crusher') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'goal_crusher', 'Goal, Met', 'A goal completed.');
  END IF;

  IF v_has_habit_streak_30 AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'habit_hero') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'habit_hero', 'Thirty Days', 'A habit, held.');
  END IF;

  IF v_has_perfect_week AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'perfect_week') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'perfect_week', 'A Full Week', 'Seven days. Every habit kept.');
  END IF;

  IF v_is_founding AND NOT EXISTS (SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'founding_member') THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'founding_member', 'Founding Member', 'Here from the beginning.');
  END IF;
END;
$function$;
