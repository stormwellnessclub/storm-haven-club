-- Least-privilege EXECUTE for four staff-only PT functions. Bodies unchanged; each already
-- rejects non-staff internally. Signed-out visitors can no longer call them at all.
REVOKE EXECUTE ON FUNCTION public.pt_check_in_appointment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_check_in_appointment(uuid, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pt_override_appointment_consequence(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_override_appointment_consequence(uuid, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pt_plan_schedule_preview_v3(uuid, uuid, integer, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_plan_schedule_preview_v3(uuid, uuid, integer, date, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pt_request_convert_inquiry(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_convert_inquiry(uuid, uuid) TO authenticated, service_role;