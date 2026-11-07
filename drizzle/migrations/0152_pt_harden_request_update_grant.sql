-- Least-privilege EXECUTE for staff-only pt_request_update. Body unchanged; it already
-- rejects non-staff internally via pt_request_can_act(). Signed-out visitors can no longer call it.
REVOKE EXECUTE ON FUNCTION public.pt_request_update(uuid, text, text, uuid, date, time without time zone, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_update(uuid, text, text, uuid, date, time without time zone, uuid, uuid) TO authenticated, service_role;