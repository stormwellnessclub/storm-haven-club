REVOKE EXECUTE ON FUNCTION public._staff_pin_hash(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._staff_pin_hash(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_mothers_day_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_mothers_day_code() TO service_role;

REVOKE EXECUTE ON FUNCTION public.pt_is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_is_staff(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pt_is_staff_or_desk(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_is_staff_or_desk(uuid) TO authenticated, service_role;