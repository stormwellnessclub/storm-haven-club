-- Add booking attribution columns to spa_appointments
ALTER TABLE public.spa_appointments
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS created_via TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by_admin_name TEXT NULL;

-- Restrict created_via values
ALTER TABLE public.spa_appointments
  DROP CONSTRAINT IF EXISTS spa_appointments_created_via_check;

ALTER TABLE public.spa_appointments
  ADD CONSTRAINT spa_appointments_created_via_check
  CHECK (created_via IS NULL OR created_via IN (
    'member_portal',
    'non_member_portal',
    'admin_booking',
    'walk_in_guest'
  ));

CREATE INDEX IF NOT EXISTS idx_spa_appointments_created_by_user
  ON public.spa_appointments(created_by_user_id);
