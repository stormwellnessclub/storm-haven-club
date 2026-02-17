
-- Create workout_templates table
CREATE TABLE public.workout_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  template_name text NOT NULL,
  workout_type text,
  exercises jsonb DEFAULT '[]'::jsonb,
  estimated_duration_minutes integer,
  notes text,
  is_favorite boolean NOT NULL DEFAULT false,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

-- Members can CRUD their own templates
CREATE POLICY "Members can view own templates"
  ON public.workout_templates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can create own templates"
  ON public.workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can update own templates"
  ON public.workout_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can delete own templates"
  ON public.workout_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all templates
CREATE POLICY "Admins can view all templates"
  ON public.workout_templates FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

-- Updated_at trigger
CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_perk_deliveries_updated_at();

-- Add exercises column to workout_logs
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS exercises jsonb DEFAULT '[]'::jsonb;
