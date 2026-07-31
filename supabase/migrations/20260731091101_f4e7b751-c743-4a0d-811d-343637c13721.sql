ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS prep_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pre_session_note text,
  ADD COLUMN IF NOT EXISTS pre_session_note_updated_at timestamptz;