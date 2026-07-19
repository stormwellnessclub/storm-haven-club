ALTER TABLE public.event_tickets
  ADD COLUMN IF NOT EXISTS abandon_reason text,
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz;