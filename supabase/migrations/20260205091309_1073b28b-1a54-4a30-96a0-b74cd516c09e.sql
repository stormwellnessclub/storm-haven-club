-- =============================================
-- Member Portal Integrity Fixes Migration
-- =============================================

-- 1. Add missing profile columns for agreement tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kids_care_agreement_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS kids_care_agreement_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS private_event_agreement_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS private_event_agreement_signed_at timestamptz,
ADD COLUMN IF NOT EXISTS kids_care_service_form_completed boolean DEFAULT false;

-- 2. Create achievements master table
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  criteria jsonb DEFAULT '{}'::jsonb,
  points_reward integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active achievements
CREATE POLICY "Anyone can view active achievements" ON public.achievements
  FOR SELECT USING (is_active = true);

-- Staff can manage achievements
CREATE POLICY "Staff can manage achievements" ON public.achievements
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- 3. Create habit_streaks table
CREATE TABLE IF NOT EXISTS public.habit_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_logged_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, member_id)
);

-- Enable RLS on habit_streaks
ALTER TABLE public.habit_streaks ENABLE ROW LEVEL SECURITY;

-- Users can view their own habit streaks
CREATE POLICY "Users can view their own habit streaks" ON public.habit_streaks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM members WHERE members.id = habit_streaks.member_id AND members.user_id = auth.uid())
  );

-- Users can manage their own habit streaks
CREATE POLICY "Users can manage their own habit streaks" ON public.habit_streaks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM members WHERE members.id = habit_streaks.member_id AND members.user_id = auth.uid())
  );

-- 4. Seed achievements data
INSERT INTO public.achievements (name, description, criteria, points_reward, is_active) VALUES
  ('First Check-In', 'Completed your first club check-in', '{"type": "check_in", "count": 1}', 10, true),
  ('Early Bird', 'Checked in before 7am', '{"type": "check_in", "time_before": "07:00"}', 15, true),
  ('Night Owl', 'Checked in after 8pm', '{"type": "check_in", "time_after": "20:00"}', 15, true),
  ('Week Warrior', 'Checked in 7 days in a row', '{"type": "check_in_streak", "days": 7}', 50, true),
  ('Month Master', 'Checked in 30 days in a month', '{"type": "check_in", "days_in_month": 30}', 100, true),
  ('Class Explorer', 'Attended 5 different class types', '{"type": "class_variety", "count": 5}', 25, true),
  ('Fitness Fanatic', 'Logged 50 workouts', '{"type": "workout_log", "count": 50}', 75, true),
  ('Goal Crusher', 'Completed your first goal', '{"type": "goal_complete", "count": 1}', 30, true),
  ('Habit Hero', 'Maintained a habit for 30 days', '{"type": "habit_streak", "days": 30}', 60, true),
  ('Wellness Warrior', 'Used all wellness amenities', '{"type": "wellness_variety", "all": true}', 40, true),
  ('Social Butterfly', 'Referred a new member', '{"type": "referral", "count": 1}', 100, true),
  ('Founding Member', 'Joined as a founding member', '{"type": "founding_member", "value": true}', 200, true),
  ('Perfect Week', 'Hit all habit goals for a week', '{"type": "habit_week_complete", "value": true}', 35, true),
  ('Century Club', 'Logged 100 check-ins', '{"type": "check_in", "count": 100}', 150, true),
  ('Spa Enthusiast', 'Booked 10 spa appointments', '{"type": "spa_booking", "count": 10}', 45, true)
ON CONFLICT DO NOTHING;

-- 5. Add missing agreements to agreements table
INSERT INTO public.agreements (agreement_type, title, pdf_url, display_order, is_required, is_active, version) VALUES
  ('liability_waiver', 'Liability Waiver', '/assets/agreements/liability-waiver.pdf', 1, true, true, '1.0'),
  ('kids_care', 'Kids Care Agreement', '/assets/agreements/kids-care-agreement.pdf', 4, true, true, '1.0'),
  ('guest_pass', 'Guest Pass Agreement', '/assets/agreements/guest-pass-agreement.pdf', 5, false, true, '1.0'),
  ('private_event', 'Private Event Agreement', '/assets/agreements/private-event-agreement.pdf', 6, false, true, '1.0')
ON CONFLICT DO NOTHING;