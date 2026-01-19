-- Add card detail columns to membership_applications table
ALTER TABLE public.membership_applications
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_exp_month INTEGER,
  ADD COLUMN IF NOT EXISTS card_exp_year INTEGER;

-- Add card detail columns to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_exp_month INTEGER,
  ADD COLUMN IF NOT EXISTS card_exp_year INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.membership_applications.card_brand IS 'Brand of the saved payment card (e.g., visa, mastercard)';
COMMENT ON COLUMN public.membership_applications.card_last4 IS 'Last 4 digits of the saved payment card';
COMMENT ON COLUMN public.membership_applications.card_exp_month IS 'Expiration month of the saved payment card';
COMMENT ON COLUMN public.membership_applications.card_exp_year IS 'Expiration year of the saved payment card';

COMMENT ON COLUMN public.members.card_brand IS 'Brand of the saved payment card (e.g., visa, mastercard)';
COMMENT ON COLUMN public.members.card_last4 IS 'Last 4 digits of the saved payment card';
COMMENT ON COLUMN public.members.card_exp_month IS 'Expiration month of the saved payment card';
COMMENT ON COLUMN public.members.card_exp_year IS 'Expiration year of the saved payment card';