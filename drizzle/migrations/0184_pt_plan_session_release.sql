ALTER TABLE public.pt_pack_payment_plans ADD COLUMN IF NOT EXISTS session_release integer[];
ALTER TABLE public.pt_passes ADD COLUMN IF NOT EXISTS sessions_on_hold integer NOT NULL DEFAULT 0;
ALTER TABLE public.pt_payment_plan_installments ADD COLUMN IF NOT EXISTS sessions_released integer;
ALTER TABLE public.pt_payment_plan_installments ADD COLUMN IF NOT EXISTS sessions_released_at timestamptz;

CREATE OR REPLACE FUNCTION public.pt_plan_release_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sessions integer; v_sum integer;
BEGIN
  IF NEW.session_release IS NULL THEN RETURN NEW; END IF;
  SELECT sessions INTO v_sessions FROM public.pt_packs WHERE id = NEW.pack_id;
  IF array_length(NEW.session_release, 1) IS DISTINCT FROM NEW.future_installment_count + 1 THEN
    RAISE EXCEPTION 'Session release needs one number per payment (% payments)', NEW.future_installment_count + 1;
  END IF;
  SELECT sum(x), bool_or(x < 0) INTO v_sum FROM unnest(NEW.session_release) x;
  IF EXISTS (SELECT 1 FROM unnest(NEW.session_release) x WHERE x < 0) THEN
    RAISE EXCEPTION 'Session release numbers cannot be negative';
  END IF;
  IF v_sum <> v_sessions THEN
    RAISE EXCEPTION 'Session release adds up to % but the package has % sessions', v_sum, v_sessions;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pt_plan_release_validate_trg ON public.pt_pack_payment_plans;
CREATE TRIGGER pt_plan_release_validate_trg BEFORE INSERT OR UPDATE ON public.pt_pack_payment_plans
FOR EACH ROW EXECUTE FUNCTION public.pt_plan_release_validate();

-- Called once right after a plan sale is finalized and its installments materialized.
CREATE OR REPLACE FUNCTION public.pt_plan_apply_session_hold(p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_rel integer[];
  v_pass public.pt_passes%ROWTYPE;
  v_hold integer; v_n integer := 0;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  SELECT session_release INTO v_rel FROM public.pt_pack_payment_plans WHERE id = v_sale.payment_plan_template_id;
  IF v_rel IS NULL THEN RETURN jsonb_build_object('success', true, 'held', 0, 'note', 'plan releases all sessions up front'); END IF;

  PERFORM set_config('pt.ledger', 'on', true);
  FOR v_pass IN SELECT * FROM public.pt_passes WHERE id = ANY(COALESCE(v_sale.pass_ids, '{}')) FOR UPDATE LOOP
    v_hold := GREATEST(v_pass.sessions_total - v_rel[1], 0);
    IF v_hold = 0 THEN CONTINUE; END IF;
    INSERT INTO public.pt_session_usage (pass_id, event_type, quantity, reason, notes, used_at, sessions_before, sessions_after, idempotency_key)
    VALUES (v_pass.id, 'plan_sessions_held', v_hold, 'Payment plan — sessions added as payments go through',
            'Payment plan — sessions added as payments go through', now(),
            v_pass.sessions_remaining, v_pass.sessions_remaining - v_hold, 'plan_hold:' || v_pass.id::text)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    UPDATE public.pt_passes SET sessions_remaining = sessions_remaining - v_hold, sessions_on_hold = v_hold, updated_at = now()
     WHERE id = v_pass.id;
    UPDATE public.pt_payment_plan_installments SET sessions_released = v_rel[1], sessions_released_at = now()
     WHERE pass_id = v_pass.id AND installment_number = 0;
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('pt.ledger', '', true);
  RETURN jsonb_build_object('success', true, 'passes_held', v_n);
END; $$;
REVOKE ALL ON FUNCTION public.pt_plan_apply_session_hold(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_plan_apply_session_hold(text) TO service_role;

-- Adds the installment's sessions once, when it becomes paid.
CREATE OR REPLACE FUNCTION public.pt_plan_release_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_rel integer[]; v_qty integer; v_pass public.pt_passes%ROWTYPE;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.installment_number < 1 THEN RETURN NEW; END IF;
  SELECT session_release INTO v_rel FROM public.pt_pack_payment_plans WHERE id = NEW.payment_plan_template_id;
  IF v_rel IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_pass FROM public.pt_passes WHERE id = NEW.pass_id FOR UPDATE;
  IF NOT FOUND OR v_pass.sessions_on_hold <= 0 THEN RETURN NEW; END IF;
  v_qty := LEAST(COALESCE(v_rel[NEW.installment_number + 1], 0), v_pass.sessions_on_hold);
  IF v_qty <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.pt_session_usage (pass_id, event_type, quantity, reason, notes, used_at, sessions_before, sessions_after, idempotency_key)
  VALUES (NEW.pass_id, 'plan_sessions_released', v_qty, 'Payment ' || (NEW.installment_number + 1) || ' received',
          'Payment ' || (NEW.installment_number + 1) || ' received', now(),
          v_pass.sessions_remaining, v_pass.sessions_remaining + v_qty, 'plan_release:' || NEW.id::text)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM set_config('pt.ledger', 'on', true);
  UPDATE public.pt_passes SET
    sessions_remaining = sessions_remaining + v_qty,
    sessions_on_hold = sessions_on_hold - v_qty,
    status = CASE WHEN status = 'exhausted' THEN 'active'::pt_pass_status ELSE status END,
    updated_at = now()
   WHERE id = NEW.pass_id;
  PERFORM set_config('pt.ledger', '', true);
  NEW.sessions_released := v_qty;
  NEW.sessions_released_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pt_plan_release_on_paid_trg ON public.pt_payment_plan_installments;
CREATE TRIGGER pt_plan_release_on_paid_trg BEFORE UPDATE OF status ON public.pt_payment_plan_installments
FOR EACH ROW EXECUTE FUNCTION public.pt_plan_release_on_paid();

-- Client-safe preview of a promo plan (no staff data).
CREATE OR REPLACE FUNCTION public.pt_promo_plans(p_promo text)
RETURNS TABLE(id uuid, pack_id uuid, installment_count integer, amount_due_at_sale_cents integer, installment_cents integer, final_installment_cents integer, plan_total_cents integer, session_release integer[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT pl.id, pl.pack_id, pl.future_installment_count + 1, pl.amount_due_at_sale_cents, pl.installment_cents,
         pl.final_installment_cents, pl.plan_total_cents, pl.session_release
  FROM public.pt_pack_payment_plans pl JOIN public.pt_packs p ON p.id = pl.pack_id
  WHERE p.promo_key = p_promo AND p.is_active AND pl.is_active AND pl.session_release IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.pt_promo_plans(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pt_my_portal()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'trainer', (
      SELECT jsonb_build_object('name', trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,'')))
      FROM pt_client_trainers ct JOIN instructors i ON i.id = ct.instructor_id
      WHERE ct.client_user_id = auth.uid() AND ct.ended_at IS NULL
      ORDER BY (ct.relationship = 'primary') DESC, ct.assigned_at DESC LIMIT 1),
    'appointments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes,
        'status', a.status, 'format', a.format,
        'session_type', st.name,
        'trainer', trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,''))
      ) ORDER BY a.starts_at DESC)
      FROM pt_appointments a
      LEFT JOIN instructors i ON i.id = a.instructor_id
      LEFT JOIN pt_session_types st ON st.id = a.session_type_id
      WHERE a.user_id = auth.uid() AND coalesce(a.is_waitlist, false) = false), '[]'::jsonb),
    'passes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'pack_name', p.pack_name, 'format', p.format, 'status', p.status,
        'sessions_total', p.sessions_total, 'sessions_remaining', p.sessions_remaining,
        'sessions_on_hold', p.sessions_on_hold,
        'activated_at', p.activated_at, 'expires_at', p.expires_at, 'purchased_at', coalesce(p.purchased_at, p.created_at),
        'price_cents', coalesce(p.plan_total_cents, p.price_cents_charged),
        'amount_paid_cents', p.amount_paid_cents, 'amount_outstanding_cents', p.amount_outstanding_cents,
        'plan_name', p.payment_plan_name_snapshot, 'plan_status', p.payment_plan_status,
        'next_payment_date', p.payment_plan_next_payment_date
      ) ORDER BY coalesce(p.purchased_at, p.created_at) DESC)
      FROM pt_passes p
      WHERE p.user_id = auth.uid() AND p.status IN ('active','exhausted','expired')), '[]'::jsonb),
    'installments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'pass_id', x.pass_id, 'installment_number', x.installment_number,
        'due_date', x.due_date, 'amount_cents', x.amount_cents, 'status', x.status,
        'paid_at', x.paid_at, 'card_brand', x.payment_method_brand, 'card_last4', x.payment_method_last4,
        'sessions', coalesce(x.sessions_released, pl.session_release[x.installment_number + 1])
      ) ORDER BY x.due_date, x.installment_number)
      FROM pt_payment_plan_installments x
      LEFT JOIN pt_pack_payment_plans pl ON pl.id = x.payment_plan_template_id
      WHERE x.user_id = auth.uid()), '[]'::jsonb),
    'payments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'amount_cents', pm.amount_cents, 'refunded_cents', pm.refunded_cents,
        'method', pm.method, 'status', pm.status, 'paid_at', coalesce(pm.paid_at, pm.created_at),
        'payment_type', pm.payment_type
      ) ORDER BY coalesce(pm.paid_at, pm.created_at) DESC)
      FROM pt_payments pm WHERE pm.user_id = auth.uid()), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'amount_cents', r.amount_cents, 'refunded_at', r.refunded_at)
        ORDER BY r.refunded_at DESC)
      FROM pt_refunds r WHERE r.user_id = auth.uid()), '[]'::jsonb),
    'programs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'status', g.status,
        'start_date', g.start_date, 'length_weeks', g.length_weeks, 'sessions_per_week', g.sessions_per_week)
        ORDER BY g.start_date DESC NULLS LAST)
      FROM pt_programs g WHERE g.user_id = auth.uid() AND coalesce(g.is_template, false) = false), '[]'::jsonb)
  ) END;
$function$;