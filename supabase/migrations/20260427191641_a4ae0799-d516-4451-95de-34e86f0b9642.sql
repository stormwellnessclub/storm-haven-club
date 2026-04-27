ALTER TABLE public.membership_applications
  ADD COLUMN IF NOT EXISTS ack_initiation_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ack_card_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ack_final_readiness boolean NOT NULL DEFAULT false;