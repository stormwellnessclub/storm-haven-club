CREATE OR REPLACE FUNCTION public.pt_outstanding_balance(p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_invoiced integer := 0; v_inv_past_due integer := 0; v_sessions integer := 0;
  v_packages integer := 0; v_plan integer := 0; v_inst_past_due integer := 0; v_future integer := 0;
BEGIN
  IF NOT (public.pt_is_staff_or_desk(auth.uid()) OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(amount_due_cents),0),
         COALESCE(SUM(amount_due_cents) FILTER (WHERE status = 'past_due'),0)
    INTO v_invoiced, v_inv_past_due
  FROM public.pt_invoices
  WHERE user_id = p_user_id AND status IN ('draft','sent','viewed','partially_paid','past_due');

  SELECT COALESCE(SUM(a.amount_due_cents),0) INTO v_sessions
  FROM public.pt_appointments a
  WHERE a.user_id = p_user_id AND COALESCE(a.payment_status,'unpaid') IN ('unpaid','past_due')
    AND a.status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.appointment_id = a.id AND i.status <> 'void');

  SELECT COALESCE(SUM(p.amount_outstanding_cents),0) INTO v_packages
  FROM public.pt_passes p
  WHERE p.user_id = p_user_id AND COALESCE(p.amount_outstanding_cents,0) > 0
    AND COALESCE(p.payment_plan_status,'none') NOT IN ('active','past_due')
    AND NOT EXISTS (SELECT 1 FROM public.pt_payment_plan_installments x WHERE x.pass_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.pass_id = p.id AND i.status <> 'void');

  -- Authoritative stored installments (B2) for plan packages.
  SELECT COALESCE(SUM(x.amount_cents) FILTER (WHERE x.status IN ('failed','past_due')),0),
         COALESCE(SUM(x.amount_cents) FILTER (WHERE x.status IN ('scheduled','processing')),0)
    INTO v_inst_past_due, v_future
  FROM public.pt_payment_plan_installments x
  JOIN public.pt_passes p ON p.id = x.pass_id
  WHERE p.user_id = p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.pt_invoice_line_items li JOIN public.pt_invoices i ON i.id = li.invoice_id
                    WHERE li.pass_id = p.id AND i.status <> 'void');

  -- Legacy plans with no installment rows fall back to their counters.
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
    'uninvoiced_sessions_cents', v_sessions,
    'package_balance_cents', v_packages,
    'plan_remaining_cents', v_plan,
    'past_due_cents', v_inst_past_due + v_inv_past_due,
    'unpaid_completed_sessions_cents', v_sessions,
    'future_scheduled_autopay_cents', v_future,
    'total_remaining_contract_balance_cents', v_invoiced + v_sessions + v_packages + v_plan,
    'total_outstanding_cents', v_invoiced + v_sessions + v_packages + v_plan
  );
END;
$function$;