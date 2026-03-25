
-- Kiosk settings table (single row for PIN)
CREATE TABLE public.kiosk_settings (
  id text PRIMARY KEY DEFAULT 'default',
  pin_hash text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default row with empty PIN (admin must set it)
INSERT INTO public.kiosk_settings (id, pin_hash) VALUES ('default', '');

-- No RLS needed for this table - access is controlled via RPCs
ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;

-- RPC to verify kiosk PIN (public, no auth needed)
CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  SELECT pin_hash INTO v_stored_hash FROM kiosk_settings WHERE id = 'default';
  IF v_stored_hash IS NULL OR v_stored_hash = '' THEN
    RETURN false;
  END IF;
  -- Simple comparison using pgcrypto crypt
  RETURN v_stored_hash = crypt(p_pin, v_stored_hash);
END;
$$;

-- RPC to set kiosk PIN (admin only)
CREATE OR REPLACE FUNCTION public.set_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  
  UPDATE kiosk_settings
  SET pin_hash = crypt(p_pin, gen_salt('bf')),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 'default';
  
  RETURN true;
END;
$$;
