-- B1.1: payment-plan template provenance + immutable sold-agreement snapshot.

ALTER TABLE public.pt_sale_intents
  ADD COLUMN IF NOT EXISTS payment_plan_template_id uuid NULL
    REFERENCES public.pt_pack_payment_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_plan_name_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS plan_total_cents integer NULL,
  ADD COLUMN IF NOT EXISTS amount_due_at_sale_cents integer NULL,
  ADD COLUMN IF NOT EXISTS future_installment_count integer NULL,
  ADD COLUMN IF NOT EXISTS final_installment_cents integer NULL,
  ADD COLUMN IF NOT EXISTS frequency_unit text NULL,
  ADD COLUMN IF NOT EXISTS frequency_interval integer NULL;

ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS payment_plan_template_id uuid NULL
    REFERENCES public.pt_pack_payment_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_plan_name_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS plan_total_cents integer NULL,
  ADD COLUMN IF NOT EXISTS amount_due_at_sale_cents integer NULL,
  ADD COLUMN IF NOT EXISTS future_installment_count integer NULL,
  ADD COLUMN IF NOT EXISTS final_installment_cents integer NULL,
  ADD COLUMN IF NOT EXISTS frequency_unit text NULL,
  ADD COLUMN IF NOT EXISTS frequency_interval integer NULL;

COMMENT ON COLUMN public.pt_passes.payment_plan_template_id IS
  'Provenance only: the catalog plan template selected at sale. Never the source of truth for the client''s agreed terms — the *_snapshot columns are.';
COMMENT ON COLUMN public.pt_sale_intents.payment_plan_template_id IS
  'Provenance only: catalog plan template selected during checkout; copied verbatim to pt_passes at finalization.';

CREATE INDEX IF NOT EXISTS idx_pt_passes_plan_template
  ON public.pt_passes(payment_plan_template_id) WHERE payment_plan_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_sale_intents_plan_template
  ON public.pt_sale_intents(payment_plan_template_id) WHERE payment_plan_template_id IS NOT NULL;

-- Sale intent records the selected template and snapshots its terms server-side.
DROP FUNCTION IF EXISTS public.pt_open_sale_intent_v2(text, uuid, uuid, integer, text, date, date, integer, integer, text, text, text, integer, integer, date, integer);

CREATE FUNCTION public.pt_open_sale_intent_v2(
  p_idempotency_key text,
  p_user_id uuid,
  p_pack_id uuid,
  p_quantity integer DEFAULT 1,
  p_payment_method text DEFAULT 'card'::text,
  p_activated_at date DEFAULT NULL::date,
  p_expires_at date DEFAULT NULL::date,
  p_price_override_cents integer DEFAULT NULL::integer,
  p_sessions_override integer DEFAULT NULL::integer,
  p_override_reason text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_sale_type text DEFAULT 'sale'::text,
  p_installment_count integer DEFAULT NULL::integer,
  p_installment_cents integer DEFAULT NULL::integer,
  p_first_installment_date date DEFAULT NULL::date,
  p_amount_due_today_cents integer DEFAULT NULL::integer,
  p_payment_plan_template_id uuid DEFAULT NULL::uuid
)
RETURNS pt_sale_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.pt_sale_intents%ROWTYPE;
  v_pack public.pt_packs%ROWTYPE;
  v_plan public.pt_pack_payment_plans%ROWTYPE;
  v_price integer;
  v_sessions integer;
  v_activated date;
  v_expires date;
  v_has_override boolean;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(btrim(COALESCE(p_idempotency_key,'')),'') = '' THEN
    RAISE EXCEPTION 'A sale reference is required';
  END IF;

  SELECT * INTO v_row FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_row; END IF;

  SELECT * INTO v_pack FROM public.pt_packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found in the catalog'; END IF;
  IF NOT v_pack.is_active THEN RAISE EXCEPTION 'That catalog package is archived'; END IF;
  IF COALESCE(p_quantity,0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  IF p_payment_plan_template_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.pt_pack_payment_plans WHERE id = p_payment_plan_template_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment plan not found'; END IF;
    IF v_plan.pack_id <> v_pack.id THEN
      RAISE EXCEPTION 'Payment plan does not belong to this package';
    END IF;
    IF NOT v_plan.is_active THEN RAISE EXCEPTION 'That payment plan is archived'; END IF;
  END IF;

  v_activated := COALESCE(p_activated_at, (now() AT TIME ZONE 'America/Detroit')::date);
  v_expires   := COALESCE(p_expires_at, v_activated + v_pack.expiration_days);

  v_has_override := (p_price_override_cents IS NOT NULL AND p_price_override_cents <> v_pack.price_cents)
                 OR (p_sessions_override IS NOT NULL AND p_sessions_override <> v_pack.sessions);

  IF v_has_override THEN
    IF NOT public.pt_is_financial_manager(auth.uid()) THEN
      RAISE EXCEPTION 'PT_OVERRIDE_NOT_AUTHORIZED: only a manager or admin can change catalog price or sessions';
    END IF;
    IF COALESCE(btrim(COALESCE(p_override_reason,'')),'') = '' THEN
      RAISE EXCEPTION 'An override reason is required';
    END IF;
  END IF;

  v_price    := COALESCE(NULLIF(p_price_override_cents, NULL), v_pack.price_cents);
  v_sessions := COALESCE(NULLIF(p_sessions_override, NULL), v_pack.sessions);
  IF v_sessions <= 0 THEN RAISE EXCEPTION 'Sessions must be positive'; END IF;
  IF v_price < 0 THEN RAISE EXCEPTION 'Price cannot be negative'; END IF;

  INSERT INTO public.pt_sale_intents (
    idempotency_key, user_id, pack_id, pack_name, format, sessions_per_pack, quantity,
    unit_price_cents, activated_at, expires_at, payment_method, notes, status, created_by,
    sale_type, catalog_price_cents, catalog_sessions, price_override_cents, sessions_override,
    override_reason, override_by, override_at, amount_due_today_cents,
    installment_count, installment_cents, first_installment_date, new_revenue_cents,
    payment_plan_template_id, payment_plan_name_snapshot, plan_total_cents,
    amount_due_at_sale_cents, future_installment_count, final_installment_cents,
    frequency_unit, frequency_interval
  ) VALUES (
    p_idempotency_key, p_user_id, v_pack.id, v_pack.name, v_pack.format, v_sessions, p_quantity,
    v_price, v_activated, v_expires, COALESCE(p_payment_method,'card'), p_notes, 'pending', auth.uid(),
    COALESCE(p_sale_type,'sale'), v_pack.price_cents, v_pack.sessions,
    CASE WHEN v_has_override THEN p_price_override_cents END,
    CASE WHEN v_has_override THEN p_sessions_override END,
    CASE WHEN v_has_override THEN btrim(p_override_reason) END,
    CASE WHEN v_has_override THEN auth.uid() END,
    CASE WHEN v_has_override THEN now() END,
    COALESCE(p_amount_due_today_cents, v_price * p_quantity),
    p_installment_count, p_installment_cents, p_first_installment_date,
    CASE WHEN COALESCE(p_sale_type,'sale') IN ('transfer','comp') THEN 0 ELSE v_price * p_quantity END,
    p_payment_plan_template_id, v_plan.name, v_plan.plan_total_cents,
    v_plan.amount_due_at_sale_cents, v_plan.future_installment_count, v_plan.final_installment_cents,
    v_plan.frequency_unit, v_plan.frequency_interval
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Finalization copies provenance + snapshot deterministically onto the sold agreement.
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
      frequency_unit, frequency_interval
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
      v_sale.frequency_unit, v_sale.frequency_interval
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