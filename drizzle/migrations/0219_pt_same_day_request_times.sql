DO $migration$
DECLARE v_name text; v_oid oid; v_before text; v_after text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['pt_client_slot_is_open','pt_client_slot_is_full','pt_client_request_times','pt_client_request_times_all','pt_request_create'] LOOP
    SELECT oid INTO STRICT v_oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = v_name;
    v_before := pg_get_functiondef(v_oid);
    v_after := v_before;
    IF v_name = 'pt_client_slot_is_open' THEN
      v_after := replace(v_after, 'v_date date; v_tomorrow timestamptz;', 'v_date date;');
      v_after := replace(v_after, '  v_tomorrow := (((now() AT TIME ZONE ''America/Detroit'')::date + 1)::timestamp) AT TIME ZONE ''America/Detroit'';' || chr(10) || '  IF p_start < v_tomorrow THEN RETURN false; END IF;', '  IF p_start <= now() THEN RETURN false; END IF;');
    ELSIF v_name = 'pt_client_slot_is_full' THEN
      v_after := replace(v_after, 'IF p_start < (((now() AT TIME ZONE ''America/Detroit'')::date + 1)::timestamp AT TIME ZONE ''America/Detroit'') THEN RETURN false; END IF;', 'IF p_start <= now() THEN RETURN false; END IF;');
    ELSIF v_name IN ('pt_client_request_times','pt_client_request_times_all') THEN
      v_after := replace(v_after, 'greatest(coalesce(p_from, v_today + 1), v_today + 1)', 'greatest(coalesce(p_from, v_today), v_today)');
    ELSIF v_name = 'pt_request_create' THEN
      v_after := replace(v_after, 'IF v_date IS NULL OR v_date <= (now() AT TIME ZONE ''America/Detroit'')::date THEN RAISE EXCEPTION ''Choose a date from tomorrow onward''; END IF;', 'IF v_date IS NULL OR v_date < (now() AT TIME ZONE ''America/Detroit'')::date THEN RAISE EXCEPTION ''Choose today or a future date''; END IF;');
      v_after := replace(v_after, 'IF v_time IS NULL THEN RAISE EXCEPTION ''Choose a preferred time''; END IF;', 'IF v_time IS NULL THEN RAISE EXCEPTION ''Choose a preferred time''; END IF;' || chr(10) || '    IF ((v_date + v_time) AT TIME ZONE ''America/Detroit'') <= now() THEN RAISE EXCEPTION ''Choose a time that has not started yet''; END IF;');
    END IF;
    IF v_after = v_before OR v_after LIKE '%v_tomorrow%' OR v_after LIKE '%v_today + 1%' OR v_after LIKE '%date from tomorrow onward%' THEN
      RAISE EXCEPTION 'Unexpected PT function definition for %, no changes applied', v_name;
    END IF;
    EXECUTE v_after;
  END LOOP;
END $migration$;