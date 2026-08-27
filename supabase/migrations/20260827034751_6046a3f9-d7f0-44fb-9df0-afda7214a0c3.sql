CREATE OR REPLACE FUNCTION public.pt_record_session_payment(p_appointment_ids uuid[], p_method text, p_amount_cents integer DEFAULT NULL::integer, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.pt_payments%ROWTYPE;
  v_user uuid;
  v_total integer := 0;
  v_appt public.pt_appointments%ROWTYPE;
  v_id uuid;
  v_alloc integer;
  v_remaining integer;
  v_count integer := 0;
  v_amount integer;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_method NOT IN ('card','cash','check','terminal','bank_transfer','other') THEN
    RAISE EXCEPTION 'Unsupported payment method %', p_method;
  END IF;
  IF COALESCE(array_length(p_appointment_ids,1),0) = 0 THEN
    RAISE EXCEPTION 'Select at least one session';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.pt_payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_payment.id);
    END IF;
  END IF;
  IF p_stripe_payment_intent_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.pt_payments WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_payment.id);
    END IF;
  END IF;

  FOREACH v_id IN ARRAY p_appointment_ids LOOP
    SELECT * INTO v_appt FROM public.pt_appointments WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF COALESCE(v_appt.payment_status,'unpaid') NOT IN ('unpaid','past_due') THEN
      RAISE EXCEPTION 'PT_ALREADY_SETTLED: session on % is already settled (%)',
        to_char(v_appt.starts_at, 'Mon DD, YYYY'), v_appt.payment_status;
    END IF;
    IF v_user IS NULL THEN v_user := v_appt.user_id;
    ELSIF v_user <> v_appt.user_id THEN RAISE EXCEPTION 'All sessions must belong to one client'; END IF;
    v_total := v_total + COALESCE(v_appt.amount_due_cents, 0);
    v_count := v_count + 1;
  END LOOP;

  v_amount := COALESCE(p_amount_cents, v_total);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'PT_INVALID_AMOUNT: payment amount must be greater than zero';
  END IF;
  IF v_amount > v_total THEN
    RAISE EXCEPTION 'PT_OVERPAYMENT: amount exceeds the % owed on the selected sessions',
      to_char(v_total / 100.0, 'FM999999990.00');
  END IF;

  INSERT INTO public.pt_payments (
    user_id, amount_cents, method, status, stripe_payment_intent_id,
    reference, note, paid_at, recorded_by, idempotency_key
  ) VALUES (
    v_user, v_amount, p_method, 'succeeded', p_stripe_payment_intent_id,
    p_reference, p_note, COALESCE(p_paid_at, now()), auth.uid(), p_idempotency_key
  ) RETURNING * INTO v_payment;

  v_remaining := v_payment.amount_cents;
  FOR v_appt IN SELECT * FROM public.pt_appointments WHERE id = ANY(p_appointment_ids) ORDER BY starts_at LOOP
    v_count := v_count - 1;
    IF v_count = 0 THEN
      v_alloc := v_remaining;
    ELSE
      v_alloc := LEAST(v_remaining, COALESCE(v_appt.amount_due_cents,0));
    END IF;
    v_remaining := v_remaining - v_alloc;

    INSERT INTO public.pt_payment_allocations (payment_id, appointment_id, amount_cents)
    VALUES (v_payment.id, v_appt.id, v_alloc)
    ON CONFLICT DO NOTHING;

    UPDATE public.pt_appointments
       SET payment_status = 'paid',
           payment_method = CASE WHEN p_method = 'card' THEN 'card' ELSE 'manual_' || p_method END,
           paid_at = COALESCE(p_paid_at, now()),
           stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
           payment_note = COALESCE(p_note, payment_note),
           updated_at = now()
     WHERE id = v_appt.id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'payment_id', v_payment.id,
                            'amount_cents', v_payment.amount_cents);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pt_settle_with_package(p_appointment_ids uuid[], p_pass_id uuid, p_reason text DEFAULT 'Settled with package session'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
    FROM public.pt_appointments
   WHERE id = ANY(p_appointment_ids)
     AND COALESCE(payment_status,'unpaid') NOT IN ('unpaid','past_due');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'PT_ALREADY_SETTLED: % of the selected sessions are already settled', v_bad;
  END IF;

  v_res := public.pt_apply_past_appointments(p_pass_id, p_appointment_ids, p_reason);

  UPDATE public.pt_appointments
     SET payment_status = 'pass', payment_method = 'package', paid_at = COALESCE(paid_at, now()), updated_at = now()
   WHERE id = ANY(p_appointment_ids)
     AND package_deducted = true;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pt_waive_sessions(p_appointment_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n integer;
  v_requested integer := COALESCE(array_length(p_appointment_ids,1),0);
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN
    RAISE EXCEPTION 'PT_WAIVE_NOT_AUTHORIZED: only a manager or admin can waive a session charge';
  END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')),'') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF v_requested = 0 THEN
    RAISE EXCEPTION 'Select at least one session';
  END IF;

  UPDATE public.pt_appointments
     SET payment_status = 'comp',
         payment_method = 'complimentary',
         paid_at = COALESCE(paid_at, now()),
         payment_note = btrim(p_reason),
         updated_at = now()
   WHERE id = ANY(p_appointment_ids)
     AND COALESCE(payment_status,'unpaid') IN ('unpaid','past_due');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'PT_ALREADY_SETTLED: the selected sessions are already settled';
  END IF;

  RETURN jsonb_build_object('success', true, 'waived', v_n, 'skipped', v_requested - v_n);
END;
$function$;