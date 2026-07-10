
CREATE OR REPLACE FUNCTION public.admin_set_staff_pin(_staff_user_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_collision uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;

  IF NOT (public.has_role(_staff_user_id, 'front_desk'::app_role)
       OR public.has_role(_staff_user_id, 'super_admin'::app_role)
       OR public.has_role(_staff_user_id, 'admin'::app_role)
       OR public.has_role(_staff_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Target user is not eligible for a staff PIN';
  END IF;

  v_hash := public._staff_pin_hash(_pin);

  SELECT user_id INTO v_collision
  FROM public.staff_pins
  WHERE pin_hash = v_hash AND user_id <> _staff_user_id
  LIMIT 1;

  IF v_collision IS NOT NULL THEN
    RAISE EXCEPTION 'That PIN is already in use. Pick a different one.';
  END IF;

  INSERT INTO public.staff_pins (user_id, pin_hash, updated_at, updated_by)
  VALUES (_staff_user_id, v_hash, now(), auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_staff_pin(_staff_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.staff_pins WHERE user_id = _staff_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_staff_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_staff_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_staff_pin(uuid) TO authenticated;
