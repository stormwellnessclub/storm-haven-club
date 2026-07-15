DO $$
DECLARE
  r record;
  new_def text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_functiondef(p.oid) ILIKE '%America/Chicago%'
  LOOP
    new_def := replace(pg_get_functiondef(r.oid), 'America/Chicago', 'America/Detroit');
    EXECUTE new_def;
  END LOOP;
END $$;