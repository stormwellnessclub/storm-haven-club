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

  PERFORM set_config('pt.ledger', 'on', true);
  INSERT INTO public.pt_session_usage (pass_id, event_type, quantity, reason, notes, used_at, sessions_before, sessions_after, idempotency_key)
  VALUES (NEW.pass_id, 'plan_sessions_released', v_qty, 'Payment ' || (NEW.installment_number + 1) || ' received',
          'Payment ' || (NEW.installment_number + 1) || ' received', now(),
          v_pass.sessions_remaining, v_pass.sessions_remaining + v_qty, 'plan_release:' || NEW.id::text)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  IF NOT FOUND THEN PERFORM set_config('pt.ledger', '', true); RETURN NEW; END IF;

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