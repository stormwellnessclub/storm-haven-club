CREATE OR REPLACE FUNCTION public.kiosk_check_in_guest_impl(p_guest_pass_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_guest record;
BEGIN
  SELECT id, guest_name, status, valid_date
  INTO v_guest
  FROM public.guest_passes
  WHERE id = p_guest_pass_id;

  IF v_guest IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest pass not found');
  END IF;

  IF v_guest.status NOT IN ('active', 'purchased') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest pass already used or expired');
  END IF;

  UPDATE public.guest_passes
  SET status = 'exhausted',
      used_at = now(),
      valid_date = current_date,
      checked_in_by = auth.uid()
  WHERE id = p_guest_pass_id;

  RETURN jsonb_build_object('success', true, 'name', v_guest.guest_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_check_in_guest_impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_guest_impl(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_guest(p_guest_pass_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_kiosk_staff();
  PERFORM set_config('TimeZone', 'America/Detroit', true);
  RETURN public.kiosk_check_in_guest_impl(p_guest_pass_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_check_in_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_guest(uuid) TO authenticated, service_role;