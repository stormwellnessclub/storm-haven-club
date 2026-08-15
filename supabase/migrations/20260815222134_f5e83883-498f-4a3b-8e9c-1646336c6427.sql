DO $migration$
DECLARE
  function_sql text;
BEGIN
  SELECT pg_get_functiondef('public.kiosk_todays_attendance_impl()'::regprocedure)
  INTO function_sql;

  function_sql := replace(
    function_sql,
    'WHERE status = ''used''',
    'WHERE status IN (''used'', ''exhausted'')'
  );

  IF function_sql NOT LIKE '%WHERE status IN (''used'', ''exhausted'')%' THEN
    RAISE EXCEPTION 'Could not update guest attendance status filter';
  END IF;

  EXECUTE function_sql;
END;
$migration$;