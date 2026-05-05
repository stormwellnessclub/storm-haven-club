
ALTER TABLE public.mothers_day_vouchers
  ADD COLUMN IF NOT EXISTS buyer_first_name text,
  ADD COLUMN IF NOT EXISTS buyer_last_name text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_gender text,
  ADD COLUMN IF NOT EXISTS recipient_first_name text,
  ADD COLUMN IF NOT EXISTS recipient_last_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_gender text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_payment_intent
  ON public.mothers_day_vouchers (stripe_payment_intent_id);
