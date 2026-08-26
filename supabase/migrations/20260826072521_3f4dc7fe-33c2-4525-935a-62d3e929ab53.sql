ALTER TABLE public.spa_intake_forms
  ADD COLUMN IF NOT EXISTS pregnancy_weeks integer,
  ADD COLUMN IF NOT EXISTS pregnancy_accommodations text,
  ADD COLUMN IF NOT EXISTS pregnancy_restrictions text;

ALTER TABLE public.spa_intake_forms
  ADD CONSTRAINT spa_intake_forms_pregnancy_weeks_range
  CHECK (pregnancy_weeks IS NULL OR (pregnancy_weeks >= 1 AND pregnancy_weeks <= 45));