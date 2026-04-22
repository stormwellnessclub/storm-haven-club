ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_id text,
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS dispute_reason text;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_dispute_id
  ON public.payment_attempts (dispute_id)
  WHERE dispute_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_disputed
  ON public.payment_attempts (disputed_at DESC)
  WHERE disputed_at IS NOT NULL;

ALTER TABLE public.billing_arrears
  ADD COLUMN IF NOT EXISTS reopened_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz;