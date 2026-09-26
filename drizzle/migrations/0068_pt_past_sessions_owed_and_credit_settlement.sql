-- 1. Outstanding balance also counts past sessions never closed out.
CREATE OR REPLACE FUNCTION public.pt_outstanding_balance(p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_invoiced integer := 0; v_inv_past_due integer := 0; v_sessions integer := 0; v_unclosed integer := 0;
  v_packages integer := 0; v_plan integer := 0; v_inst_past_due integer := 0; v_future integer := 0;
BEGIN
  IF NOT (public.pt_is_staff_or_desk(auth.uid()) OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(amount_due_cents),0), COALESCE(SUM(amount_due_cents) FILTER (WHERE status = 'past_due'),0)
    INTO v_invoiced, v_inv_past_due
  FROM public.pt_invoices
  WHERE user_id = p_user_id AND status IN ('draft','sent','viewed','partially_paid','past_due');

  SELECT COALESCE(SUM(a.amount_due_cents) FILTER (WHERE a.status = 'completed'),0),
         COALESCE(SUM(a.amount_due_cents) FILTER (WHERE a.status = 'scheduled'),0)
    INTO v_sessions, v_unclosed
  FROM public.pt_appointments a
  WHERE a.user_id = p_user_id AND COALESCE(a.payment_status,'unpaid') IN ('unpaid','past_due')
    AND (a.status = 'completed' OR (a.status = 'scheduled' AND a.starts_at < now()))
    AND a.pass_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.appointment_id = a.id AND i.status <> 'void');

  SELECT COALESCE(SUM(p.amount_outstanding_cents),0) INTO v_packages
  FROM public.pt_passes p
  WHERE p.user_id = p_user_id AND COALESCE(p.amount_outstanding_cents,0) > 0
    AND COALESCE(p.payment_plan_status,'none') NOT IN ('active','past_due')
    AND NOT EXISTS (SELECT 1 FROM public.pt_payment_plan_installments x WHERE x.pass_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.pass_id = p.id AND i.status <> 'void');

  SELECT COALESCE(SUM(x.amount_cents) FILTER (WHERE x.status IN ('failed','past_due')),0),
         COALESCE(SUM(x.amount_cents) FILTER (WHERE x.status IN ('scheduled','processing')),0)
    INTO v_inst_past_due, v_future
  FROM public.pt_payment_plan_installments x JOIN public.pt_passes p ON p.id = x.pass_id
  WHERE p.user_id = p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.pass_id = p.id AND i.status <> 'void');

  SELECT COALESCE(SUM(GREATEST(COALESCE(p.payment_plan_total_installments,0) - COALESCE(p.payment_plan_installments_paid,0), 0)
         * COALESCE(p.payment_plan_installment_cents,0)), 0) INTO v_plan
  FROM public.pt_passes p
  WHERE p.user_id = p_user_id AND COALESCE(p.payment_plan_status,'none') IN ('active','past_due')
    AND NOT EXISTS (SELECT 1 FROM public.pt_payment_plan_installments x WHERE x.pass_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.pass_id = p.id AND i.status <> 'void');

  v_plan := v_plan + v_inst_past_due + v_future;

  RETURN jsonb_build_object(
    'open_invoices_cents', v_invoiced,
    'uninvoiced_sessions_cents', v_sessions + v_unclosed,
    'package_balance_cents', v_packages,
    'plan_remaining_cents', v_plan,
    'past_due_cents', v_inst_past_due + v_inv_past_due,
    'unpaid_completed_sessions_cents', v_sessions,
    'unclosed_past_sessions_cents', v_unclosed,
    'future_scheduled_autopay_cents', v_future,
    'total_remaining_contract_balance_cents', v_invoiced + v_sessions + v_unclosed + v_packages + v_plan,
    'total_outstanding_cents', v_invoiced + v_sessions + v_unclosed + v_packages + v_plan
  );
END;
$function$;

-- 2. Settling with a package closes out past unclosed sessions first, then uses exactly one credit each.
CREATE OR REPLACE FUNCTION public.pt_settle_with_package(p_appointment_ids uuid[], p_pass_id uuid, p_reason text DEFAULT 'Settled with package session'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb; v_bad integer; v_pass public.pt_passes%ROWTYPE; v_need integer;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT count(*) INTO v_bad FROM public.pt_appointments
   WHERE id = ANY(p_appointment_ids) AND COALESCE(payment_status,'unpaid') NOT IN ('unpaid','past_due');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'PT_ALREADY_SETTLED: % of the selected sessions are already settled', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM public.pt_appointments
   WHERE id = ANY(p_appointment_ids) AND NOT (status = 'completed' OR (status = 'scheduled' AND starts_at < now()));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'PT_NOT_ELIGIBLE: only completed or past sessions can be settled with a package';
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  IF v_pass.status <> 'active' OR (v_pass.expires_at IS NOT NULL AND v_pass.expires_at < now()) THEN
    RAISE EXCEPTION 'PT_PACKAGE_INACTIVE: this package is expired or inactive';
  END IF;
  SELECT count(*) INTO v_need FROM public.pt_appointments a
   WHERE a.id = ANY(p_appointment_ids)
     AND NOT EXISTS (SELECT 1 FROM public.pt_session_usage u WHERE u.appointment_id = a.id AND u.quantity < 0 AND u.reversed_at IS NULL);
  IF v_need > COALESCE(v_pass.sessions_remaining,0) THEN
    RAISE EXCEPTION 'PT_NOT_ENOUGH_CREDITS: % credit(s) needed, % left on this package', v_need, v_pass.sessions_remaining;
  END IF;

  UPDATE public.pt_appointments
     SET status = 'completed', completed_at = COALESCE(completed_at, starts_at), updated_at = now()
   WHERE id = ANY(p_appointment_ids) AND status = 'scheduled' AND starts_at < now();

  v_res := public.pt_apply_past_appointments(p_pass_id, p_appointment_ids, p_reason);

  UPDATE public.pt_appointments
     SET payment_status = 'pass', payment_method = 'package', paid_at = COALESCE(paid_at, now()), updated_at = now()
   WHERE id = ANY(p_appointment_ids) AND package_deducted = true;
  RETURN v_res;
END;
$function$;