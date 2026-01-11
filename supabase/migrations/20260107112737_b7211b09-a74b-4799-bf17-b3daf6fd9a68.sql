-- Create workout_programs table
CREATE TABLE public.workout_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL CHECK (program_type IN ('strength', 'hypertrophy', 'fat_loss', 'endurance')),
  duration_weeks INTEGER NOT NULL DEFAULT 4,
  days_per_week INTEGER NOT NULL CHECK (days_per_week >= 2 AND days_per_week <= 6),
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  target_body_parts TEXT[] DEFAULT '{}',
  split_type TEXT CHECK (split_type IN ('full_body', 'upper_lower', 'push_pull_legs', 'bro_split')),
  progression_style TEXT CHECK (progression_style IN ('linear', 'undulating', 'block')),
  ai_reasoning TEXT,
  is_active BOOLEAN DEFAULT true,
  current_week INTEGER DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create program_workouts table
CREATE TABLE public.program_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 4),
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  workout_name TEXT NOT NULL,
  workout_type TEXT,
  focus_area TEXT,
  exercises JSONB NOT NULL DEFAULT '[]',
  duration_minutes INTEGER,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_workouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for workout_programs
CREATE POLICY "Members can view their own programs"
  ON public.workout_programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members can create their own programs"
  ON public.workout_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update their own programs"
  ON public.workout_programs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Members can delete their own programs"
  ON public.workout_programs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for program_workouts (via program ownership)
CREATE POLICY "Members can view their program workouts"
  ON public.program_workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_programs wp
      WHERE wp.id = program_workouts.program_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create program workouts"
  ON public.program_workouts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_programs wp
      WHERE wp.id = program_workouts.program_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update their program workouts"
  ON public.program_workouts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_programs wp
      WHERE wp.id = program_workouts.program_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete their program workouts"
  ON public.program_workouts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_programs wp
      WHERE wp.id = program_workouts.program_id
      AND wp.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_workout_programs_member_id ON public.workout_programs(member_id);
CREATE INDEX idx_workout_programs_user_id ON public.workout_programs(user_id);
CREATE INDEX idx_workout_programs_is_active ON public.workout_programs(is_active) WHERE is_active = true;
CREATE INDEX idx_program_workouts_program_id ON public.program_workouts(program_id);
CREATE INDEX idx_program_workouts_week_day ON public.program_workouts(program_id, week_number, day_number);

-- Create updated_at triggers
CREATE TRIGGER update_workout_programs_updated_at
  BEFORE UPDATE ON public.workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_program_workouts_updated_at
  BEFORE UPDATE ON public.program_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();