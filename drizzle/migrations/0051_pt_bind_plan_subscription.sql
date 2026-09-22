-- Stripe subscription schedules only materialize the subscription when the first
-- future installment bills. Binding happens once, on the first invoice webhook.
CREATE OR REPLACE FUNCTION public.pt_bind_plan_subscription(
  p_sale_ref text, p_subscription_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_sale_ref IS NULL OR p_subscription_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sale ref and subscription required');
  END IF;

  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_sale_ref;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'sale not found'); END IF;

  UPDATE public.pt_passes SET stripe_subscription_id = p_subscription_id, updated_at = now()
   WHERE id = ANY(COALESCE(v_sale.pass_ids, '{}'))
     AND (stripe_subscription_id IS DISTINCT FROM p_subscription_id);

  UPDATE public.pt_payment_plan_installments SET stripe_subscription_id = p_subscription_id
   WHERE sale_intent_id = v_sale.id
     AND (stripe_subscription_id IS DISTINCT FROM p_subscription_id);

  UPDATE public.pt_sale_intents SET stripe_subscription_id = p_subscription_id, updated_at = now()
   WHERE id = v_sale.id AND stripe_subscription_id IS DISTINCT FROM p_subscription_id;

  RETURN jsonb_build_object('success', true, 'pass_ids', v_sale.pass_ids);
END; $$;