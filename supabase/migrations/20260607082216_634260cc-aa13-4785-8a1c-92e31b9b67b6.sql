ALTER TABLE public.spa_appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_spa_appointments_reminder_lookup
  ON public.spa_appointments (appointment_date, appointment_time, status)
  WHERE status = 'confirmed';