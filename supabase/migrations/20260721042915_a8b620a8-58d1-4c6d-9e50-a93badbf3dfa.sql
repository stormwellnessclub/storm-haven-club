ALTER TABLE public.manual_charges
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_manual_charges_status_created
  ON public.manual_charges (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_charges_user_created
  ON public.manual_charges (user_id, created_at DESC);