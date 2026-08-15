CREATE OR REPLACE FUNCTION public.kiosk_search_visitors(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.assert_kiosk_staff();
  PERFORM set_config('TimeZone', 'America/Detroit', true);
  RETURN public.kiosk_search_visitors_impl(p_query);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_guest(p_guest_pass_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.assert_kiosk_staff();
  PERFORM set_config('TimeZone', 'America/Detroit', true);
  RETURN public.kiosk_check_in_guest_impl(p_guest_pass_id);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.kiosk_search_visitors(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_search_visitors(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_guest(uuid) TO authenticated, service_role;