-- Member Fitness Profiles Table
-- Stores member fitness goals, preferences, and constraints for AI workout generation

CREATE TABLE public.member_fitness_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fitness_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  primary_goal TEXT, -- 'weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'general_fitness', 'athletic_performance'
  secondary_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  available_equipment TEXT[] DEFAULT ARRAY[]::TEXT[], -- 'dumbbells', 'resistance_bands', 'barbell', 'kettlebell', 'pull_up_bar', 'none', 'full_gym'
  available_time_minutes INTEGER DEFAULT 30,
  workout_preferences JSONB DEFAULT '{}'::JSONB, -- {intensity: 'low' | 'moderate' | 'high', style: 'hiit' | 'strength' | 'cardio' | 'mixed', frequency: 'daily' | '3x_week' | '5x_week'}
  injuries_limitations TEXT[] DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

-- Enable Row Level Security
ALTER TABLE public.member_fitness_profiles ENABLE ROW LEVEL SECURITY;

-- Members can view their own fitness profile
CREATE POLICY "Members can view their own fitness profile"
ON public.member_fitness_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_fitness_profiles.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can insert their own fitness profile
CREATE POLICY "Members can create their own fitness profile"
ON public.member_fitness_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_fitness_profiles.member_id
    AND members.user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Members can update their own fitness profile
CREATE POLICY "Members can update their own fitness profile"
ON public.member_fitness_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_fitness_profiles.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all fitness profiles
CREATE POLICY "Staff can view all fitness profiles"
ON public.member_fitness_profiles
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_member_fitness_profiles_member_id ON public.member_fitness_profiles(member_id);
CREATE INDEX idx_member_fitness_profiles_user_id ON public.member_fitness_profiles(user_id);
CREATE INDEX idx_member_fitness_profiles_primary_goal ON public.member_fitness_profiles(primary_goal);

-- Trigger for updated_at
CREATE TRIGGER update_member_fitness_profiles_updated_at
BEFORE UPDATE ON public.member_fitness_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



