DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.admin_person_activity()'::regprocedure) INTO definition;
  IF position('IF NOT public.has_any_role(auth.uid(), ARRAY[''super_admin'',''admin'',''manager'']::app_role[]) THEN' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected activity authorization definition; no changes applied';
  END IF;
  definition := replace(definition,
    'IF NOT public.has_any_role(auth.uid(), ARRAY[''super_admin'',''admin'',''manager'']::app_role[]) THEN',
    'IF coalesce(auth.role(), '''') <> ''service_role'' AND NOT public.has_any_role(auth.uid(), ARRAY[''super_admin'',''admin'',''manager'']::app_role[]) THEN');
  EXECUTE definition;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_person_activity() TO service_role;