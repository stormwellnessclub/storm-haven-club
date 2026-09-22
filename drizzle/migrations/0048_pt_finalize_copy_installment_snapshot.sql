-- Carry the per-installment snapshot from the sale intent onto the sold agreement at
-- finalization, so the agreed schedule is complete even before Stripe linkage.
CREATE OR REPLACE FUNCTION public.pt_finalize_package_sale(p_idempotency_key text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_pass_id uuid;
  v_ids uuid[] := '{}';
  v_actor uuid := COALESCE(auth.uid(), p_actor);
  v_requires_payment boolean;
  v_unit integer;
  v_new_revenue integer;
  v_fin text;
  i integer;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sale FROM public.pt_sale_intents
    WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF v_sale.status = 'finalized' THEN
    PERFORM public.pt_sale_payment_record(p_idempotency_key);
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'pass_ids', v_sale.pass_ids);
  END IF;

  v_requires_payment := COALESCE(v_sale.payment_method,'') IN
    ('card_on_file','card','terminal','payment_plan','stripe');
  IF v_requires_payment AND v_sale.status <> 'paid' THEN
    RAISE EXCEPTION 'PT_SALE_UNPAID: this sale has not been paid yet — record the payment before creating the package';
  END IF;

  v_unit := GREATEST(COALESCE(v_sale.unit_price_cents, 0), 0);
  v_new_revenue := CASE
    WHEN COALESCE(v_sale.sale_type,'sale') IN ('transfer','comp') THEN 0
    WHEN COALESCE(v_sale.payment_method,'') IN ('legacy','comp') THEN 0
    ELSE v_unit
  END;
  v_fin := CASE
    WHEN COALESCE(v_sale.sale_type,'sale') = 'payment_plan' THEN 'payment_plan'
    WHEN v_new_revenue = 0 AND v_unit = 0 THEN 'comp'
    ELSE 'paid_in_full'
  END;

  PERFORM set_config('pt.ledger', 'on', true);

  FOR i IN 1..v_sale.quantity LOOP
    INSERT INTO public.pt_passes (
      user_id, pack_id, format, pack_name, sessions_total, sessions_remaining,
      price_cents_charged, activated_at, expires_at, status, payment_method,
      stripe_payment_intent_id, sold_by_admin_id, notes, purchased_at,
      source_type, financial_status, amount_paid_cents, amount_outstanding_cents,
      new_revenue_cents, catalog_price_cents, catalog_sessions,
      price_override_cents, sessions_override, override_reason, override_by, override_at,
      payment_plan_template_id, payment_plan_name_snapshot, plan_total_cents,
      amount_due_at_sale_cents, future_installment_count, final_installment_cents,
      frequency_unit, frequency_interval,
      payment_plan_installment_cents, payment_plan_total_installments
    ) VALUES (
      v_sale.user_id, v_sale.pack_id, v_sale.format, v_sale.pack_name,
      v_sale.sessions_per_pack, v_sale.sessions_per_pack, v_unit,
      v_sale.activated_at, v_sale.expires_at, 'active', v_sale.payment_method,
      v_sale.stripe_payment_intent_id, COALESCE(v_sale.created_by, v_actor), v_sale.notes, now(),
      'sale', v_fin,
      CASE WHEN v_fin = 'payment_plan' THEN 0 ELSE v_unit END,
      CASE WHEN v_fin = 'payment_plan' THEN v_unit ELSE 0 END,
      v_new_revenue, v_sale.catalog_price_cents, v_sale.catalog_sessions,
      v_sale.price_override_cents, v_sale.sessions_override,
      v_sale.override_reason, v_sale.override_by, v_sale.override_at,
      v_sale.payment_plan_template_id, v_sale.payment_plan_name_snapshot, v_sale.plan_total_cents,
      v_sale.amount_due_at_sale_cents, v_sale.future_installment_count, v_sale.final_installment_cents,
      v_sale.frequency_unit, v_sale.frequency_interval,
      v_sale.installment_cents, v_sale.installment_count
    ) RETURNING id INTO v_pass_id;

    v_ids := v_ids || v_pass_id;

    INSERT INTO public.pt_session_usage (
      pass_id, event_type, quantity, reason, notes, used_at, used_by_admin_id, created_by,
      sessions_before, sessions_after, idempotency_key
    ) VALUES (
      v_pass_id, 'package_granted', v_sale.sessions_per_pack,
      'Package sold — ' || v_sale.pack_name, 'Package sold — ' || v_sale.pack_name,
      now(), COALESCE(v_sale.created_by, v_actor), COALESCE(v_sale.created_by, v_actor),
      0, v_sale.sessions_per_pack, 'sale_grant:' || p_idempotency_key || ':' || i::text
    );
  END LOOP;

  PERFORM set_config('pt.ledger', '', true);

  UPDATE public.pt_sale_intents
     SET status = 'finalized', pass_ids = v_ids, finalized_at = now(), finalize_error = NULL
   WHERE id = v_sale.id;

  PERFORM public.pt_sale_payment_record(p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'pass_ids', v_ids);
END;
$function$;