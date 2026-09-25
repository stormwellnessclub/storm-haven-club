CREATE OR REPLACE FUNCTION public.pt_historical_unresolved_list()
RETURNS TABLE(id uuid, user_id uuid, instructor_id uuid, format text, session_type_name text, starts_at timestamptz, status text,
  pass_id uuid, pack_name text, sessions_remaining int, sessions_total int, package_deducted boolean, reservation_state text,
  consumed_usage_count int, payment_status text, amount_due_cents int, invoice_count int, allocation_count int,
  eligible_pass_id uuid, eligible_pack_name text, eligible_sessions_remaining int, needs_review boolean, review_reasons text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE a pt_appointments%ROWTYPE; v_pick uuid; v_reasons text[];
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RETURN; END IF;
  FOR a IN SELECT * FROM pt_appointments x WHERE x.status='scheduled' AND x.starts_at < now() ORDER BY x.starts_at LOOP
    v_pick := NULL; v_reasons := ARRAY[]::text[];
    IF NOT COALESCE(a.package_deducted,false) AND COALESCE(a.reservation_state,'none')='none' THEN
      BEGIN v_pick := public.pt_pick_pass_for_appointment(a); EXCEPTION WHEN OTHERS THEN v_pick := NULL; END;
    END IF;
    IF a.instructor_id IS NULL THEN v_reasons := array_append(v_reasons, 'No trainer recorded'::text); END IF;
    IF v_pick IS NOT NULL THEN v_reasons := array_append(v_reasons, 'Client has a current package that a completed/no-show/late outcome could draw from'::text); END IF;
    IF COALESCE(a.package_deducted,false) AND NOT EXISTS (SELECT 1 FROM pt_session_usage u WHERE u.appointment_id=a.id AND u.quantity<0 AND u.reversed_at IS NULL) THEN
      v_reasons := array_append(v_reasons, 'Marked deducted with no session history entry'::text); END IF;
    id := a.id; user_id := a.user_id; instructor_id := a.instructor_id; format := a.format::text; starts_at := a.starts_at; status := a.status::text;
    pass_id := a.pass_id; package_deducted := COALESCE(a.package_deducted,false); reservation_state := COALESCE(a.reservation_state,'none');
    payment_status := a.payment_status; amount_due_cents := a.amount_due_cents;
    session_type_name := NULL;
    SELECT st.name INTO session_type_name FROM pt_session_types st WHERE st.id = a.session_type_id;
    SELECT p.pack_name, p.sessions_remaining, p.sessions_total INTO pack_name, sessions_remaining, sessions_total FROM pt_passes p WHERE p.id=a.pass_id;
    IF a.pass_id IS NULL THEN pack_name := NULL; sessions_remaining := NULL; sessions_total := NULL; END IF;
    SELECT count(*)::int INTO consumed_usage_count FROM pt_session_usage u WHERE u.appointment_id=a.id AND u.quantity<0 AND u.reversed_at IS NULL;
    SELECT count(*)::int INTO invoice_count FROM pt_invoice_line_items li WHERE li.appointment_id=a.id;
    SELECT count(*)::int INTO allocation_count FROM pt_payment_allocations pa WHERE pa.appointment_id=a.id;
    eligible_pass_id := v_pick; eligible_pack_name := NULL; eligible_sessions_remaining := NULL;
    IF v_pick IS NOT NULL THEN SELECT p.pack_name, p.sessions_remaining INTO eligible_pack_name, eligible_sessions_remaining FROM pt_passes p WHERE p.id=v_pick; END IF;
    needs_review := array_length(v_reasons,1) IS NOT NULL; review_reasons := v_reasons;
    RETURN NEXT;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.pt_historical_unresolved_list() TO authenticated, service_role;