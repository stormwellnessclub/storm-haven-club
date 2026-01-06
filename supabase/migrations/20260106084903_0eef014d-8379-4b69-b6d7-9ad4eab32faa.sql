-- Create ai_workouts table for storing AI-generated workout plans
CREATE TABLE public.ai_workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  workout_name TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  duration_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  exercises JSONB DEFAULT '[]'::jsonb,
  ai_reasoning TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_workouts ENABLE ROW LEVEL SECURITY;

-- Members can view their own workouts
CREATE POLICY "Members can view own ai_workouts"
  ON public.ai_workouts FOR SELECT
  USING (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Members can update their own workouts (for marking complete)
CREATE POLICY "Members can update own ai_workouts"
  ON public.ai_workouts FOR UPDATE
  USING (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Members can delete their own workouts
CREATE POLICY "Members can delete own ai_workouts"
  ON public.ai_workouts FOR DELETE
  USING (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Service role can insert (for the edge function)
CREATE POLICY "Service role can insert ai_workouts"
  ON public.ai_workouts FOR INSERT
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_ai_workouts_member_id ON public.ai_workouts(member_id);
CREATE INDEX idx_ai_workouts_created_at ON public.ai_workouts(created_at DESC);