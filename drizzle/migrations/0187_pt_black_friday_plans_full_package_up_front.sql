-- Black Friday payment-plan buyers get the whole package at purchase; admins track usage against payments.
UPDATE public.pt_pack_payment_plans pl
   SET session_release = NULL, updated_at = now()
  FROM public.pt_packs pk
 WHERE pk.id = pl.pack_id AND pk.promo_key = 'black_friday_2026' AND pl.session_release IS NOT NULL;

-- Release sessions already held on Black Friday plan packages (one at the time of this change).
DO $$
DECLARE v_pass public.pt_passes%ROWTYPE;
BEGIN
  PERFORM set_config('pt.ledger', 'on', true);
  FOR v_pass IN
    SELECT p.* FROM public.pt_passes p
      JOIN public.pt_pack_payment_plans pl ON pl.id = p.payment_plan_template_id
      JOIN public.pt_packs pk ON pk.id = pl.pack_id
     WHERE pk.promo_key = 'black_friday_2026' AND coalesce(p.sessions_on_hold, 0) > 0
     FOR UPDATE OF p
  LOOP
    INSERT INTO public.pt_session_usage (pass_id, event_type, quantity, reason, notes, used_at, sessions_before, sessions_after, idempotency_key)
    VALUES (v_pass.id, 'plan_sessions_released', v_pass.sessions_on_hold, 'Full package available up front',
            'Owner decision: payment-plan packages are fully available at purchase; usage tracked against payments',
            now(), v_pass.sessions_remaining, v_pass.sessions_remaining + v_pass.sessions_on_hold,
            'plan_release_all:' || v_pass.id::text)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    UPDATE public.pt_passes
       SET sessions_remaining = sessions_remaining + sessions_on_hold, sessions_on_hold = 0,
           status = CASE WHEN status = 'exhausted' THEN 'active'::pt_pass_status ELSE status END,
           updated_at = now()
     WHERE id = v_pass.id;
  END LOOP;
  PERFORM set_config('pt.ledger', '', true);
END $$;