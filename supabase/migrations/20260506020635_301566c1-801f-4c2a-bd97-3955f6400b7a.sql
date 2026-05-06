
ALTER TABLE public.mothers_day_vouchers
  ADD COLUMN IF NOT EXISTS sold_in_house boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS admin_notes text;
