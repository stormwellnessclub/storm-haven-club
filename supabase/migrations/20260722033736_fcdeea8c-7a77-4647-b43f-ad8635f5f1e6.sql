
-- 1. Add PT public visibility toggle to instructors
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS is_public_pt boolean NOT NULL DEFAULT false;

-- 2. Weekly availability
CREATE TABLE public.pt_trainer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX pt_trainer_availability_instructor_idx ON public.pt_trainer_availability(instructor_id);

GRANT SELECT ON public.pt_trainer_availability TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pt_trainer_availability TO authenticated;
GRANT ALL ON public.pt_trainer_availability TO service_role;
ALTER TABLE public.pt_trainer_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pt availability" ON public.pt_trainer_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage pt availability" ON public.pt_trainer_availability
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

-- 3. Date overrides
CREATE TABLE public.pt_trainer_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('block','extra')),
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'block' OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX pt_trainer_overrides_instructor_date_idx ON public.pt_trainer_overrides(instructor_id, date);

GRANT SELECT ON public.pt_trainer_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pt_trainer_overrides TO authenticated;
GRANT ALL ON public.pt_trainer_overrides TO service_role;
ALTER TABLE public.pt_trainer_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pt overrides" ON public.pt_trainer_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage pt overrides" ON public.pt_trainer_overrides
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

-- 4. Per-format eligibility
CREATE TABLE public.pt_trainer_formats (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  format pt_format NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, format)
);
GRANT SELECT ON public.pt_trainer_formats TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pt_trainer_formats TO authenticated;
GRANT ALL ON public.pt_trainer_formats TO service_role;
ALTER TABLE public.pt_trainer_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pt formats" ON public.pt_trainer_formats
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage pt formats" ON public.pt_trainer_formats
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

-- 5. Notes (shared + per-trainer)
CREATE TABLE public.pt_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('shared','trainer')),
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'shared' AND instructor_id IS NULL) OR (scope = 'trainer' AND instructor_id IS NOT NULL))
);
CREATE INDEX pt_notes_scope_idx ON public.pt_notes(scope, instructor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_notes TO authenticated;
GRANT ALL ON public.pt_notes TO service_role;
ALTER TABLE public.pt_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pt notes" ON public.pt_notes
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));
CREATE POLICY "staff write pt notes" ON public.pt_notes
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

-- 6. updated_at triggers
CREATE TRIGGER pt_trainer_availability_updated BEFORE UPDATE ON public.pt_trainer_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pt_trainer_overrides_updated BEFORE UPDATE ON public.pt_trainer_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pt_notes_updated BEFORE UPDATE ON public.pt_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
