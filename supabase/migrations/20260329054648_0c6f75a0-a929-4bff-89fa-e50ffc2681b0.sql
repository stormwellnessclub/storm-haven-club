
CREATE OR REPLACE FUNCTION verify_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  SELECT pin_hash INTO v_stored_hash FROM kiosk_settings WHERE id = 'default';
  IF v_stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_stored_hash = extensions.crypt(p_pin, v_stored_hash);
END;
$$;

CREATE OR REPLACE FUNCTION set_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE kiosk_settings
  SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 'default';

  RETURN true;
END;
$$;
