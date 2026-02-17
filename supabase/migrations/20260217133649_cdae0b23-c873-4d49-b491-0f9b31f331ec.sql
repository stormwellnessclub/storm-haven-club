
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
  -- Get user_id for this member
  SELECT user_id INTO v_user_id FROM members WHERE id = _member_id;
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- ========== GATHER COUNTS ==========

  -- Total check-ins
  SELECT COUNT(*) INTO v_check_in_count FROM check_ins WHERE member_id = _member_id;

  -- Check-ins in last 30 days
  SELECT COUNT(*) INTO v_check_in_30d FROM check_ins
  WHERE member_id = _member_id AND checked_in_at > now() - interval '30 days';

  -- Total workouts
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs WHERE member_id = _member_id;

  -- Spa appointments (confirmed/completed)
  SELECT COUNT(*) INTO v_spa_count FROM spa_appointments
  WHERE member_id = _member_id AND status IN ('confirmed', 'completed');

  -- Distinct class types booked
  SELECT COUNT(DISTINCT cs.class_type_id) INTO v_class_variety
  FROM class_bookings cb
  JOIN class_sessions cs ON cs.id = cb.session_id
  WHERE cb.user_id = v_user_id AND cb.status IN ('confirmed', 'completed');

  -- Distinct amenity types logged
  SELECT COUNT(DISTINCT amenity_type) INTO v_amenity_variety
  FROM amenity_usage_logs WHERE member_id = _member_id;

  -- Early Bird: any check-in before 7am
  SELECT EXISTS(
    SELECT 1 FROM check_ins
    WHERE member_id = _member_id AND EXTRACT(HOUR FROM checked_in_at) < 7
  ) INTO v_has_early_bird;

  -- Night Owl: any check-in after 8pm
  SELECT EXISTS(
    SELECT 1 FROM check_ins
    WHERE member_id = _member_id AND EXTRACT(HOUR FROM checked_in_at) >= 20
  ) INTO v_has_night_owl;

  -- Week Warrior: max consecutive check-in days >= 7
  WITH check_in_days AS (
    SELECT DISTINCT checked_in_at::date AS d FROM check_ins WHERE member_id = _member_id
  ),
  grouped AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM check_in_days
  ),
  streaks AS (
    SELECT COUNT(*) AS streak_len FROM grouped GROUP BY grp
  )
  SELECT COALESCE(MAX(streak_len), 0) INTO v_max_streak FROM streaks;

  -- Goal Crusher: any completed goal
  SELECT EXISTS(
    SELECT 1 FROM member_goals WHERE member_id = _member_id AND status = 'completed'
  ) INTO v_has_completed_goal;

  -- Habit Hero: any habit streak >= 30
  SELECT EXISTS(
    SELECT 1 FROM habit_streaks WHERE member_id = _member_id AND current_streak >= 30
  ) INTO v_has_habit_streak_30;

  -- Perfect Week: 7 consecutive days of habit logs
  WITH habit_days AS (
    SELECT DISTINCT logged_date AS d FROM habit_logs
    WHERE habit_id IN (SELECT id FROM habits WHERE member_id = _member_id)
  ),
  grouped AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM habit_days
  ),
  streaks AS (
    SELECT COUNT(*) AS streak_len FROM grouped GROUP BY grp
  )
  SELECT EXISTS(SELECT 1 FROM streaks WHERE streak_len >= 7) INTO v_has_perfect_week;

  -- Founding Member
  SELECT COALESCE(is_founding_member, false) INTO v_is_founding FROM members WHERE id = _member_id;

  -- ========== AWARD ACHIEVEMENTS ==========

  -- 1. First Check-In
  IF v_check_in_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'first_check_in'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'first_check_in', 'First Check-In', 'Checked in for the first time');
  END IF;

  -- 2. Century Club
  IF v_check_in_count >= 100 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'century_club'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'century_club', 'Century Club', 'Reached 100 check-ins');
  END IF;

  -- 3. Month Master
  IF v_check_in_30d >= 30 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'month_master'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'month_master', 'Month Master', 'Checked in every day for 30 days');
  END IF;

  -- 4. Early Bird
  IF v_has_early_bird AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'early_bird'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'early_bird', 'Early Bird', 'Checked in before 7 AM');
  END IF;

  -- 5. Night Owl
  IF v_has_night_owl AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'night_owl'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'night_owl', 'Night Owl', 'Checked in after 8 PM');
  END IF;

  -- 6. Week Warrior
  IF v_max_streak >= 7 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'week_warrior'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'week_warrior', 'Week Warrior', '7-day consecutive check-in streak');
  END IF;

  -- 7. First Steps (workout)
  IF v_workout_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'first_workout'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'first_workout', 'First Steps', 'Completed your first workout');
  END IF;

  -- 8. Fitness Fanatic
  IF v_workout_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'fitness_fanatic'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'fitness_fanatic', 'Fitness Fanatic', 'Logged 50 workouts');
  END IF;

  -- 9. Spa Enthusiast
  IF v_spa_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'spa_enthusiast'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'spa_enthusiast', 'Spa Enthusiast', 'Booked 10 spa appointments');
  END IF;

  -- 10. Class Explorer
  IF v_class_variety >= 5 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'class_explorer'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'class_explorer', 'Class Explorer', 'Tried 5 different class types');
  END IF;

  -- 11. Wellness Warrior
  IF v_amenity_variety >= 6 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'wellness_warrior'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'wellness_warrior', 'Wellness Warrior', 'Used all 6 amenity types');
  END IF;

  -- 12. Goal Crusher
  IF v_has_completed_goal AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'goal_crusher'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'goal_crusher', 'Goal Crusher', 'Completed your first goal');
  END IF;

  -- 13. Habit Hero
  IF v_has_habit_streak_30 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'habit_hero'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'habit_hero', 'Habit Hero', 'Maintained a 30-day habit streak');
  END IF;

  -- 14. Perfect Week
  IF v_has_perfect_week AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'perfect_week'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'perfect_week', 'Perfect Week', 'Logged habits every day for a full week');
  END IF;

  -- 15. Founding Member
  IF v_is_founding AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'founding_member'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'founding_member', 'Founding Member', 'One of the original founding members');
  END IF;

END;
$function$;
