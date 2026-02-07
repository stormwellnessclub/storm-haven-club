-- Fix function search path for the trigger function we just created
CREATE OR REPLACE FUNCTION public.update_member_perk_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;