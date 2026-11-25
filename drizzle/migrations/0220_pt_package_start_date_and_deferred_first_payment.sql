DO $mig$
DECLARE d text; n int;
  rep text[][] := ARRAY[
    ARRAY['pt_pick_pass_for_appointment',
      'AND (p.expires_at IS NULL OR p.expires_at >= (now() AT TIME ZONE ''America/Detroit'')::date)',
      'AND (p.expires_at IS NULL OR p.expires_at >= (now() AT TIME ZONE ''America/Detroit'')::date)
        AND (p.activated_at IS NULL OR p.activated_at <= (COALESCE(p_appt.starts_at, now()) AT TIME ZONE ''America/Detroit'')::date)'],
    ARRAY['pt_request_confirm',
      'AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE ''America/Detroit'')::date',
      'AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE ''America/Detroit'')::date AND (activated_at IS NULL OR activated_at <= (now() AT TIME ZONE ''America/Detroit'')::date)'],
    ARRAY['pt_settle_with_package',
      'IF v_pass.status <> ''active'' OR (v_pass.expires_at IS NOT NULL AND v_pass.expires_at < now()) THEN',
      'IF v_pass.activated_at IS NOT NULL AND v_pass.activated_at > (now() AT TIME ZONE ''America/Detroit'')::date THEN
    RAISE EXCEPTION ''PT_PASS_NOT_STARTED: This package starts on %'', v_pass.activated_at;
  END IF;
  IF v_pass.status <> ''active'' OR (v_pass.expires_at IS NOT NULL AND v_pass.expires_at < now()) THEN'],
    ARRAY['pt_manual_consume_session',
      'IF v_pass.status <> ''active'' THEN RAISE EXCEPTION ''Package is not active''; END IF;',
      'IF v_pass.status <> ''active'' THEN RAISE EXCEPTION ''Package is not active''; END IF;
  IF v_pass.activated_at IS NOT NULL AND v_pass.activated_at > (now() AT TIME ZONE ''America/Detroit'')::date THEN RAISE EXCEPTION ''Package has not started yet (starts %)'', v_pass.activated_at; END IF;'],
    ARRAY['pt_reconcile_installment',
      'AND installment_number > 0',
      'AND (installment_number > 0 OR status = ''scheduled'')']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(rep,1) LOOP
    SELECT count(*) INTO n FROM pg_proc WHERE proname = rep[i][1] AND pronamespace = 'public'::regnamespace;
    IF n <> 1 THEN RAISE EXCEPTION 'expected one %', rep[i][1]; END IF;
    SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname = rep[i][1] AND pronamespace = 'public'::regnamespace;
    IF position(rep[i][2] in d) = 0 THEN RAISE EXCEPTION 'pattern not found in %', rep[i][1]; END IF;
    EXECUTE replace(d, rep[i][2], rep[i][3]);
  END LOOP;
END $mig$;