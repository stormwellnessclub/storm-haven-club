ALTER TABLE public.mothers_day_vouchers
  ADD COLUMN IF NOT EXISTS base_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee_cents integer NOT NULL DEFAULT 0;

UPDATE public.mothers_day_vouchers
  SET base_amount_cents = amount_paid_cents
  WHERE base_amount_cents = 0 AND amount_paid_cents > 0;