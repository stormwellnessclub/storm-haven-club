ALTER TABLE public.manual_charges ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.cafe_orders ADD COLUMN IF NOT EXISTS note TEXT;