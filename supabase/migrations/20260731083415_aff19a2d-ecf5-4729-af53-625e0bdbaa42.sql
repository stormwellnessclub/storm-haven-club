
ALTER TABLE public.pt_programs
  ADD COLUMN IF NOT EXISTS phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS template_name text;

ALTER TABLE public.pt_program_days
  ADD COLUMN IF NOT EXISTS week_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS homework text,
  ADD COLUMN IF NOT EXISTS phase text;

ALTER TABLE public.pt_program_exercises
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS media_url text;

ALTER TABLE public.pt_exercise_library
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS cues text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS default_sets integer,
  ADD COLUMN IF NOT EXISTS default_reps text,
  ADD COLUMN IF NOT EXISTS default_tempo text,
  ADD COLUMN IF NOT EXISTS default_rest text;

ALTER TABLE public.pt_session_notes
  ADD COLUMN IF NOT EXISTS pain_discomfort text,
  ADD COLUMN IF NOT EXISTS program_id uuid;

ALTER TABLE public.pt_prs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS previous_weight_lbs numeric,
  ADD COLUMN IF NOT EXISTS previous_reps integer,
  ADD COLUMN IF NOT EXISTS program_exercise_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS pt_prs_status_idx ON public.pt_prs (status, user_id);
CREATE INDEX IF NOT EXISTS pt_program_days_program_idx ON public.pt_program_days (program_id, week_number, display_order);
CREATE INDEX IF NOT EXISTS pt_program_exercises_day_idx ON public.pt_program_exercises (day_id, display_order);
