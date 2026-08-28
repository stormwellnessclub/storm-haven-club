-- Phase 2C gap closure: PT package/installment money records, PT-scoped dunning,
-- and dunning isolation between membership and personal training.

-- 1. Caller guard used by webhook (service role) and financial staff.
CREATE OR REPLACE FUNCTION public.pt_is_service_or_financial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json->>'role' = 'service_role',
    false)
  OR public.pt_is_financial_staff(auth.uid());
$$;

-- 2. Money record for a paid package sale (package purchase / first installment).
CREATE OR REPLACE FUNCTION public.pt_sale_payment_record(p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_key text;
  v_pay public.pt_payments%ROWTYPE;
  v_type text;
  v_method text;
  v_amount integer;
  v_pass uuid;
BEGIN
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND OR v_sale.pass_ids IS NULL THEN RETURN NULL; END IF;

  v_amount := COALESCE(v_sale.amount_charged_cents, 0);
  IF v_amount <= 0 THEN RETURN NULL; END IF;           -- comp / outstanding sales collect no money
  IF v_sale.status NOT IN ('paid','finalized') THEN RETURN NULL; END IF;

  v_key := 'pt_sale:' || p_idempotency_key;
  SELECT * INTO v_pay FROM public.pt_payments WHERE idempotency_key = v_key;
  IF FOUND THEN RETURN v_pay.id; END IF;

  v_type := CASE WHEN COALESCE(v_sale.payment_method,'') = 'payment_plan' THEN 'installment' ELSE 'package' END;
  v_method := CASE
    WHEN COALESCE(v_sale.payment_method,'') IN ('card_on_file','card','stripe','payment_plan') THEN 'card'
    WHEN v_sale.payment_method = 'terminal' THEN 'terminal'
    WHEN v_sale.payment_method IN ('cash','check','bank_transfer') THEN v_sale.payment_method
    ELSE 'other' END;

  INSERT INTO public.pt_payments (user_id, amount_cents, method, status, stripe_payment_intent_id,
                                  reference, note, paid_at, recorded_by, idempotency_key, payment_type)
  VALUES (v_sale.user_id, v_amount, v_method, 'succeeded', v_sale.stripe_payment_intent_id,
          v_sale.source_reference, 'Package sale — ' || COALESCE(v_sale.pack_name,'PT package'),
          COALESCE(v_sale.paid_at, now()), v_sale.created_by, v_key, v_type)
  RETURNING * INTO v_pay;

  FOREACH v_pass IN ARRAY v_sale.pass_ids LOOP
    INSERT INTO public.pt_payment_allocations (payment_id, pass_id, amount_cents)
    VALUES (v_pay.id, v_pass, (v_amount / GREATEST(array_length(v_sale.pass_ids,1),1))::int)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_pay.id;
END;
$$;

-- 3. Finalization now also writes the money record (single source: pt_payments).
CREATE OR REPLACE FUNCTION public.pt_finalize_package_sale(p_idempotency_key text, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
      price_override_cents, sessions_override, override_reason, override_by, override_at
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
      v_sale.override_reason, v_sale.override_by, v_sale.override_at
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
$$;

-- 4. Installment collected (Stripe webhook): one money record per Stripe invoice.
CREATE OR REPLACE FUNCTION public.pt_record_installment_payment(
  p_subscription_id text,
  p_stripe_invoice_id text,
  p_amount_cents integer,
  p_paid_at timestamptz DEFAULT now(),
  p_payment_intent_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_key text := 'pt_installment:' || p_stripe_invoice_id;
  v_pay public.pt_payments%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(p_amount_cents,0) <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid amount'); END IF;

  SELECT * INTO v_pay FROM public.pt_payments WHERE idempotency_key = v_key;
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_pay.id); END IF;

  SELECT * INTO v_pass FROM public.pt_passes
   WHERE stripe_subscription_id = p_subscription_id
   ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'no PT package for subscription'); END IF;

  INSERT INTO public.pt_payments (user_id, amount_cents, method, status, reference, note, paid_at,
                                  idempotency_key, payment_type, stripe_payment_intent_id)
  VALUES (v_pass.user_id, p_amount_cents, 'card', 'succeeded', p_stripe_invoice_id,
          'Payment plan installment — ' || COALESCE(v_pass.pack_name,'PT package'),
          COALESCE(p_paid_at, now()), v_key, 'installment', p_payment_intent_id)
  RETURNING * INTO v_pay;

  INSERT INTO public.pt_payment_allocations (payment_id, pass_id, amount_cents)
  VALUES (v_pay.id, v_pass.id, p_amount_cents) ON CONFLICT DO NOTHING;

  UPDATE public.pt_passes
     SET amount_paid_cents = COALESCE(amount_paid_cents,0) + p_amount_cents,
         amount_outstanding_cents = GREATEST(COALESCE(amount_outstanding_cents,0) - p_amount_cents, 0),
         updated_at = now()
   WHERE stripe_subscription_id = p_subscription_id;

  -- a successful installment resolves any open PT dunning on this obligation
  UPDATE public.payment_dunning_state
     SET status = 'recovered', recovered_at = now(), updated_at = now()
   WHERE service_type = 'personal_training'
     AND stripe_subscription_id = p_subscription_id
     AND status = 'active';

  INSERT INTO public.pt_payment_communications (user_id, recipient, comm_type, template, payment_id, delivery_status, created_by)
  VALUES (v_pass.user_id,
          COALESCE((SELECT email FROM public.profiles WHERE user_id = v_pass.user_id LIMIT 1), 'unknown'),
          'receipt', 'stripe_hosted_receipt', v_pay.id, 'stripe_owned', NULL);

  RETURN jsonb_build_object('success', true, 'payment_id', v_pay.id, 'pass_id', v_pass.id);
END;
$$;

-- 5. Failed installment (Stripe webhook): PT-scoped dunning obligation.
CREATE OR REPLACE FUNCTION public.pt_register_failed_installment(
  p_subscription_id text,
  p_stripe_invoice_id text,
  p_customer_id text,
  p_amount_cents integer,
  p_failure_reason text DEFAULT NULL,
  p_failure_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_row public.payment_dunning_state%ROWTYPE;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_pass FROM public.pt_passes
   WHERE stripe_subscription_id = p_subscription_id ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'no PT package for subscription'); END IF;

  SELECT * INTO v_row FROM public.payment_dunning_state
   WHERE service_type = 'personal_training' AND stripe_invoice_id = p_stripe_invoice_id;

  IF FOUND THEN
    UPDATE public.payment_dunning_state
       SET retry_count = COALESCE(retry_count,0) + 1,
           last_retry_at = now(),
           failure_reason = COALESCE(p_failure_reason, failure_reason),
           failure_code = COALESCE(p_failure_code, failure_code),
           status = 'active',
           updated_at = now()
     WHERE id = v_row.id;
    RETURN jsonb_build_object('success', true, 'dunning_id', v_row.id, 'attempt', COALESCE(v_row.retry_count,0) + 1);
  END IF;

  INSERT INTO public.payment_dunning_state (
    member_id, stripe_invoice_id, stripe_subscription_id, stripe_customer_id, amount_cents,
    failure_reason, failure_code, status, first_failed_at, retry_count,
    service_type, pt_pass_id, metadata)
  VALUES (
    (SELECT id FROM public.members WHERE user_id = v_pass.user_id LIMIT 1),
    p_stripe_invoice_id, p_subscription_id, p_customer_id, COALESCE(p_amount_cents,0),
    p_failure_reason, p_failure_code, 'active', now(), 1,
    'personal_training', v_pass.id,
    jsonb_build_object('pt_user_id', v_pass.user_id, 'pack_name', v_pass.pack_name))
  RETURNING * INTO v_row;

  INSERT INTO public.pt_payment_communications (user_id, recipient, comm_type, template, delivery_status)
  VALUES (v_pass.user_id,
          COALESCE((SELECT email FROM public.profiles WHERE user_id = v_pass.user_id LIMIT 1), 'unknown'),
          'payment_failed', 'stripe_dunning', 'stripe_owned');

  RETURN jsonb_build_object('success', true, 'dunning_id', v_row.id, 'attempt', 1);
END;
$$;

-- 6. PT obligations for the failed-payment center, with the client identity the UI needs.
CREATE OR REPLACE FUNCTION public.pt_failed_obligations()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'user_id', p.user_id,
      'pass_id', p.id,
      'pack_name', p.pack_name,
      'amount_cents', d.amount_cents,
      'outstanding_cents', p.amount_outstanding_cents,
      'first_failed_at', d.first_failed_at,
      'last_retry_at', d.last_retry_at,
      'attempts', COALESCE(d.retry_count,0),
      'status', d.status,
      'failure_reason', d.failure_reason,
      'due_date', p.payment_plan_next_payment_date,
      'stripe_invoice_id', d.stripe_invoice_id,
      'stripe_subscription_id', d.stripe_subscription_id)
      ORDER BY d.first_failed_at DESC)
    FROM public.payment_dunning_state d
    LEFT JOIN public.pt_passes p ON p.id = d.pt_pass_id
    WHERE d.service_type = 'personal_training' AND d.status = 'active'), '[]'::jsonb);
END;
$$;

-- 7. Manual settlement of a failed PT obligation: records real money, stops retries.
CREATE OR REPLACE FUNCTION public.pt_resolve_failed_obligation(
  p_dunning_id uuid, p_method text, p_amount_cents integer, p_reference text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_row public.payment_dunning_state%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
  v_key text;
  v_pay public.pt_payments%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_method NOT IN ('cash','check','terminal','bank_transfer','other') THEN
    RAISE EXCEPTION 'Manual settlement must use an offline method';
  END IF;
  IF COALESCE(p_amount_cents,0) <= 0 THEN RAISE EXCEPTION 'PT_INVALID_AMOUNT'; END IF;

  SELECT * INTO v_row FROM public.payment_dunning_state
   WHERE id = p_dunning_id AND service_type = 'personal_training' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PT obligation not found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'PT_ALREADY_RESOLVED'; END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = v_row.pt_pass_id;
  v_key := 'pt_manual_dunning:' || p_dunning_id::text;
  SELECT * INTO v_pay FROM public.pt_payments WHERE idempotency_key = v_key;
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_pay.id); END IF;

  INSERT INTO public.pt_payments (user_id, amount_cents, method, status, reference, note, paid_at,
                                  recorded_by, idempotency_key, payment_type)
  VALUES (v_pass.user_id, p_amount_cents, p_method, 'succeeded', p_reference,
          COALESCE(p_note, 'Offline settlement of failed installment'), now(),
          auth.uid(), v_key, 'installment')
  RETURNING * INTO v_pay;

  INSERT INTO public.pt_payment_allocations (payment_id, pass_id, amount_cents)
  VALUES (v_pay.id, v_pass.id, p_amount_cents) ON CONFLICT DO NOTHING;

  UPDATE public.pt_passes
     SET amount_paid_cents = COALESCE(amount_paid_cents,0) + p_amount_cents,
         amount_outstanding_cents = GREATEST(COALESCE(amount_outstanding_cents,0) - p_amount_cents, 0),
         payment_plan_installments_paid = LEAST(COALESCE(payment_plan_installments_paid,0) + 1,
                                                COALESCE(payment_plan_total_installments, COALESCE(payment_plan_installments_paid,0) + 1)),
         payment_plan_status = 'active',
         updated_at = now()
   WHERE id = v_pass.id;

  UPDATE public.payment_dunning_state
     SET status = 'recovered', recovered_at = now(), updated_at = now(),
         metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('resolved_manually', true, 'pt_payment_id', v_pay.id)
   WHERE id = p_dunning_id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_pay.id);
END;
$$;

-- 8. Voiding an invoice must also stop any retry chasing it.
CREATE OR REPLACE FUNCTION public.pt_void_invoice(p_invoice_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inv public.pt_invoices%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO v_inv FROM public.pt_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'void' THEN RETURN jsonb_build_object('success', true, 'already_void', true); END IF;
  IF v_inv.amount_paid_cents > 0 THEN
    RAISE EXCEPTION 'PT_INVOICE_HAS_PAYMENTS: refund the payments before voiding this invoice';
  END IF;

  UPDATE public.pt_invoices
     SET status = 'void', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason,
         amount_due_cents = 0
   WHERE id = p_invoice_id;

  UPDATE public.payment_dunning_state
     SET status = 'abandoned', abandoned_at = now(), updated_at = now()
   WHERE service_type = 'personal_training' AND pt_invoice_id = p_invoice_id AND status = 'active';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Existing dunning rows are membership obligations; keep the discriminator explicit.
UPDATE public.payment_dunning_state SET service_type = 'membership' WHERE service_type IS NULL;

GRANT EXECUTE ON FUNCTION public.pt_is_service_or_financial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_sale_payment_record(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_record_installment_payment(text, text, integer, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_register_failed_installment(text, text, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_failed_obligations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_resolve_failed_obligation(uuid, text, integer, text, text) TO authenticated, service_role;