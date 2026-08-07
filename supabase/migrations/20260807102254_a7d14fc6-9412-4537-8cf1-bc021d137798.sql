REVOKE EXECUTE ON FUNCTION public.admin_delete_trainer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_trainer(uuid) TO authenticated, service_role;