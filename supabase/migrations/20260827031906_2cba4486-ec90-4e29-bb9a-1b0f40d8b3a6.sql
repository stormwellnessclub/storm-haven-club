-- ============================================================
-- PHASE 2B — PT packages, autopay, reconciliation & checkout
-- Pre-migration counts: pt_appointments=55, pt_passes=6,
-- pt_session_usage=9, pt_pass_adjustments=0, pt_sale_intents=0
-- ============================================================

-- ---------- 1. pt_passes provenance / financial position ----------
ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS original_purchase_date date,
  ADD COLUMN IF NOT EXISTS historical_value_cents integer,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_outstanding_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_revenue_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'paid_in_full',
  ADD COLUMN IF NOT EXISTS catalog_price_cents integer,
  ADD COLUMN IF NOT EXISTS catalog_sessions integer,
  ADD COLUMN IF NOT EXISTS price_override_cents integer,
  ADD COLUMN IF NOT EXISTS sessions_override integer,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS payment_plan_total_cents integer,
  ADD COLUMN IF NOT EXISTS payment_plan_installment_cents integer,
  ADD COLUMN IF NOT EXISTS payment_plan_next_payment_date date,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Deterministic backfill only: existing plan subscription id -> dedicated column.
UPDATE public.pt_passes
   SET stripe_subscription_id = payment_plan_subscription_id
 WHERE payment_plan_subscription_id IS NOT NULL
   AND stripe_subscription_id IS NULL;

-- Existing packages that were genuinely sold keep sale semantics.
UPDATE public.pt_passes
   SET amount_paid_cents = COALESCE(price_cents_charged, 0),
       new_revenue_cents = COALESCE(price_cents_charged, 0)
 WHERE amount_paid_cents = 0 AND COALESCE(price_cents_charged,0) > 0;

CREATE INDEX IF NOT EXISTS pt_passes_subscription_idx ON public.pt_passes (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pt_passes_source_idx ON public.pt_passes (source_type);

-- ---------- 2. pt_sale_intents: catalog derivation + plan fields ----------
ALTER TABLE public.pt_sale_intents
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS catalog_price_cents integer,
  ADD COLUMN IF NOT EXISTS catalog_sessions integer,
  ADD COLUMN IF NOT EXISTS price_override_cents integer,
  ADD COLUMN IF NOT EXISTS sessions_override integer,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_due_today_cents integer,
  ADD COLUMN IF NOT EXISTS installment_count integer,
  ADD COLUMN IF NOT EXISTS installment_cents integer,
  ADD COLUMN IF NOT EXISTS first_installment_date date,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS historical_value_cents integer,
  ADD COLUMN IF NOT EXISTS previously_paid_cents integer,
  ADD COLUMN IF NOT EXISTS new_revenue_cents integer;

-- Deterministic: a subscription id stored in the PaymentIntent column belongs in the
-- subscription column. (Currently zero such rows; the statement is a no-op safety net.)
UPDATE public.pt_sale_intents
   SET stripe_subscription_id = stripe_payment_intent_id
 WHERE stripe_payment_intent_id LIKE 'sub_%'
   AND stripe_subscription_id IS NULL;

-- ---------- 3. PT payments + allocations ----------
CREATE TABLE IF NOT EXISTS public.pt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'succeeded',
  stripe_payment_intent_id text,
  reference text,
  note text,
  internal_note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pt_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.pt_payments(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pt_payments_idem_uidx
  ON public.pt_payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pt_payments_pi_uidx
  ON public.pt_payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pt_pay_alloc_uidx
  ON public.pt_payment_allocations (payment_id, appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pt_pay_alloc_appt_idx ON public.pt_payment_allocations (appointment_id);
CREATE INDEX IF NOT EXISTS pt_payments_user_idx ON public.pt_payments (user_id, paid_at DESC);

GRANT SELECT ON public.pt_payments TO authenticated;
GRANT ALL ON public.pt_payments TO service_role;
GRANT SELECT ON public.pt_payment_allocations TO authenticated;
GRANT ALL ON public.pt_payment_allocations TO service_role;

ALTER TABLE public.pt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_payments staff read" ON public.pt_payments;
CREATE POLICY "pt_payments staff read" ON public.pt_payments
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));

DROP POLICY IF EXISTS "pt_payments own read" ON public.pt_payments;
CREATE POLICY "pt_payments own read" ON public.pt_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pt_alloc staff read" ON public.pt_payment_allocations;
CREATE POLICY "pt_alloc staff read" ON public.pt_payment_allocations
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));

DROP POLICY IF EXISTS "pt_alloc own read" ON public.pt_payment_allocations;
CREATE POLICY "pt_alloc own read" ON public.pt_payment_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pt_payments p WHERE p.id = payment_id AND p.user_id = auth.uid()));

DROP TRIGGER IF EXISTS pt_payments_touch ON public.pt_payments;
CREATE TRIGGER pt_payments_touch BEFORE UPDATE ON public.pt_payments
  FOR EACH ROW EXECUTE FUNCTION public.pt_touch_updated_at();

-- ---------- 4. Elevated financial role (overrides / waivers / plans) ----------
CREATE OR REPLACE FUNCTION public.pt_is_financial_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager']::app_role[])
      OR public.pt_request_role() = 'service_role';
$$;
REVOKE ALL ON FUNCTION public.pt_is_financial_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_is_financial_manager(uuid) TO authenticated, service_role;

-- ---------- 5. Server-derived catalog sale intent ----------
CREATE OR REPLACE FUNCTION public.pt_open_sale_intent_v2(
  p_idempotency_key text,
  p_user_id uuid,
  p_pack_id uuid,
  p_quantity integer DEFAULT 1,
  p_payment_method text DEFAULT 'card',
  p_activated_at date DEFAULT NULL,
  p_expires_at date DEFAULT NULL,
  p_price_override_cents integer DEFAULT NULL,
  p_sessions_override integer DEFAULT NULL,
  p_override_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_sale_type text DEFAULT 'sale',
  p_installment_count integer DEFAULT NULL,
  p_installment_cents integer DEFAULT NULL,
  p_first_installment_date date DEFAULT NULL,
  p_amount_due_today_cents integer DEFAULT NULL
) RETURNS public.pt_sale_intents
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_row public.pt_sale_intents%ROWTYPE;
  v_pack public.pt_packs%ROWTYPE;
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

  -- Catalog is authoritative.
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
    installment_count, installment_cents, first_installment_date, new_revenue_cents
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
    CASE WHEN COALESCE(p_sale_type,'sale') IN ('transfer','comp') THEN 0 ELSE v_price * p_quantity END
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.pt_open_sale_intent_v2(text,uuid,uuid,integer,text,date,date,integer,integer,text,text,text,integer,integer,date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_open_sale_intent_v2(text,uuid,uuid,integer,text,date,date,integer,integer,text,text,text,integer,integer,date,integer) TO authenticated, service_role;

-- ---------- 6. Enrich finalization with provenance/financial position ----------
CREATE OR REPLACE FUNCTION public.pt_apply_sale_financials(p_idempotency_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sale public.pt_sale_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND OR v_sale.pass_ids IS NULL THEN RETURN; END IF;

  UPDATE public.pt_passes SET
    source_type = COALESCE(v_sale.sale_type,'sale'),
    source_system = v_sale.source_system,
    source_reference = v_sale.source_reference,
    catalog_price_cents = v_sale.catalog_price_cents,
    catalog_sessions = v_sale.catalog_sessions,
    price_override_cents = v_sale.price_override_cents,
    sessions_override = v_sale.sessions_override,
    override_reason = v_sale.override_reason,
    override_by = v_sale.override_by,
    override_at = v_sale.override_at,
    amount_paid_cents = CASE
        WHEN v_sale.payment_method IN ('payment_plan') THEN COALESCE(v_sale.installment_cents, 0)
        WHEN v_sale.status IN ('paid','finalized') THEN v_sale.unit_price_cents
        ELSE 0 END,
    amount_outstanding_cents = CASE
        WHEN v_sale.payment_method = 'payment_plan'
          THEN GREATEST(0, v_sale.unit_price_cents - COALESCE(v_sale.installment_cents,0))
        WHEN v_sale.payment_method IN ('outstanding','invoice') THEN v_sale.unit_price_cents
        ELSE 0 END,
    new_revenue_cents = COALESCE(v_sale.new_revenue_cents, v_sale.unit_price_cents),
    financial_status = CASE
        WHEN v_sale.payment_method = 'payment_plan' THEN 'payment_plan'
        WHEN v_sale.payment_method = 'comp' THEN 'complimentary'
        WHEN v_sale.payment_method IN ('outstanding','invoice') THEN 'outstanding'
        WHEN COALESCE(v_sale.sale_type,'sale') = 'transfer' THEN 'transferred'
        ELSE 'paid_in_full' END,
    updated_at = now()
  WHERE id = ANY(v_sale.pass_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.pt_apply_sale_financials(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_apply_sale_financials(text) TO authenticated, service_role;

-- ---------- 7. Add an existing / transferred package ----------
CREATE OR REPLACE FUNCTION public.pt_add_existing_package(
  p_idempotency_key text,
  p_user_id uuid,
  p_pack_id uuid,
  p_pack_name text,
  p_format pt_format,
  p_sessions_original integer,
  p_sessions_used integer,
  p_sessions_remaining integer,
  p_activated_at date,
  p_expires_at date,
  p_source_type text DEFAULT 'existing',
  p_financial_status text DEFAULT 'paid_in_full',
  p_package_value_cents integer DEFAULT 0,
  p_paid_cents integer DEFAULT 0,
  p_outstanding_cents integer DEFAULT 0,
  p_new_revenue_cents integer DEFAULT 0,
  p_original_purchase_date date DEFAULT NULL,
  p_source_system text DEFAULT NULL,
  p_source_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pack public.pt_packs%ROWTYPE;
  v_name text;
  v_format pt_format;
  v_pass_id uuid;
  v_existing uuid;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_source_type = 'transfer' AND NOT public.pt_is_financial_manager(auth.uid()) THEN
    RAISE EXCEPTION 'PT_TRANSFER_NOT_AUTHORIZED: only a manager or admin can transfer a package in';
  END IF;
  IF COALESCE(btrim(COALESCE(p_idempotency_key,'')),'') = '' THEN
    RAISE EXCEPTION 'A reference is required';
  END IF;

  -- Idempotent: the grant ledger row carries the key.
  SELECT pass_id INTO v_existing FROM public.pt_session_usage
   WHERE idempotency_key = 'existing_pkg:' || p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'pass_id', v_existing);
  END IF;

  IF COALESCE(p_sessions_original,0) <= 0 THEN RAISE EXCEPTION 'Original session count must be positive'; END IF;
  IF COALESCE(p_sessions_used,0) < 0 OR COALESCE(p_sessions_remaining,0) < 0 THEN
    RAISE EXCEPTION 'Session counts cannot be negative';
  END IF;
  IF p_sessions_original <> (p_sessions_used + p_sessions_remaining) THEN
    RAISE EXCEPTION 'PT_SESSION_MATH: original (%) must equal used (%) + remaining (%)',
      p_sessions_original, p_sessions_used, p_sessions_remaining;
  END IF;

  v_name := NULLIF(btrim(COALESCE(p_pack_name,'')),'');
  v_format := p_format;
  IF p_pack_id IS NOT NULL THEN
    SELECT * INTO v_pack FROM public.pt_packs WHERE id = p_pack_id;
    IF FOUND THEN
      v_name := COALESCE(v_name, v_pack.name);
      v_format := COALESCE(v_format, v_pack.format);
    END IF;
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'A package name is required'; END IF;
  IF v_format IS NULL THEN RAISE EXCEPTION 'A session format is required'; END IF;

  PERFORM set_config('pt.ledger','on',true);

  INSERT INTO public.pt_passes (
    user_id, pack_id, format, pack_name, sessions_total, sessions_remaining,
    price_cents_charged, activated_at, expires_at, status, payment_method,
    sold_by_admin_id, notes, purchased_at,
    source_type, source_system, source_reference, original_purchase_date,
    historical_value_cents, amount_paid_cents, amount_outstanding_cents,
    new_revenue_cents, financial_status, internal_notes
  ) VALUES (
    p_user_id, p_pack_id, v_format, v_name, p_sessions_original, p_sessions_original,
    COALESCE(p_new_revenue_cents,0), p_activated_at, p_expires_at,
    CASE WHEN p_sessions_remaining = 0 THEN 'exhausted' ELSE 'active' END::pt_pass_status,
    CASE WHEN p_source_type = 'transfer' THEN 'legacy_transfer' ELSE 'existing_record' END,
    auth.uid(), p_notes, COALESCE(p_original_purchase_date::timestamptz, now()),
    COALESCE(p_source_type,'existing'), p_source_system, p_source_reference, p_original_purchase_date,
    NULLIF(COALESCE(p_package_value_cents,0),0), COALESCE(p_paid_cents,0), COALESCE(p_outstanding_cents,0),
    COALESCE(p_new_revenue_cents,0), COALESCE(p_financial_status,'paid_in_full'), p_internal_notes
  ) RETURNING id INTO v_pass_id;

  INSERT INTO public.pt_session_usage (
    pass_id, event_type, quantity, reason, notes, used_at, used_by_admin_id, created_by,
    sessions_before, sessions_after, idempotency_key
  ) VALUES (
    v_pass_id,
    CASE WHEN p_source_type = 'transfer' THEN 'package_transferred_in' ELSE 'package_existing_added' END,
    p_sessions_original,
    CASE WHEN p_source_type = 'transfer'
         THEN 'Package transferred in — ' || v_name || COALESCE(' (' || p_source_system || ')','')
         ELSE 'Existing package recorded — ' || v_name END,
    p_notes, now(), auth.uid(), auth.uid(), 0, p_sessions_original,
    'existing_pkg:' || p_idempotency_key
  );

  PERFORM set_config('pt.ledger','',true);

  IF p_sessions_used > 0 THEN
    PERFORM public.pt_apply_session_delta(
      p_pass_id => v_pass_id,
      p_delta => -p_sessions_used,
      p_event_type => 'historical_usage_backfill',
      p_reason => 'Sessions already completed before this package was recorded',
      p_idempotency_key => 'existing_pkg_used:' || p_idempotency_key,
      p_actor => auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'pass_id', v_pass_id,
    'sessions_total', p_sessions_original, 'sessions_remaining', p_sessions_remaining
  );
END;
$$;
REVOKE ALL ON FUNCTION public.pt_add_existing_package(text,uuid,uuid,text,pt_format,integer,integer,integer,date,date,text,text,integer,integer,integer,integer,date,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_add_existing_package(text,uuid,uuid,text,pt_format,integer,integer,integer,date,date,text,text,integer,integer,integer,integer,date,text,text,text,text) TO authenticated, service_role;

-- ---------- 8. Eligible past completed appointments ----------
CREATE OR REPLACE FUNCTION public.pt_eligible_past_appointments(p_user_id uuid)
RETURNS TABLE (
  id uuid, starts_at timestamptz, instructor_id uuid, format pt_format,
  session_type_id uuid, status text, payment_status text,
  amount_due_cents integer, pass_id uuid, already_applied boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id, a.starts_at, a.instructor_id, a.format, a.session_type_id,
         a.status, a.payment_status, a.amount_due_cents, a.pass_id,
         EXISTS (
           SELECT 1 FROM public.pt_session_usage u
            WHERE u.appointment_id = a.id
              AND u.quantity < 0
              AND u.reversed_at IS NULL
         ) AS already_applied
    FROM public.pt_appointments a
   WHERE a.user_id = p_user_id
     AND a.status = 'completed'
     AND public.pt_is_staff_or_desk(auth.uid())
   ORDER BY a.starts_at DESC;
$$;
REVOKE ALL ON FUNCTION public.pt_eligible_past_appointments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_eligible_past_appointments(uuid) TO authenticated, service_role;

-- ---------- 9. Apply past completed appointments to a package ----------
CREATE OR REPLACE FUNCTION public.pt_apply_past_appointments(
  p_pass_id uuid,
  p_appointment_ids uuid[],
  p_reason text DEFAULT 'Historical session reconciliation'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_appt public.pt_appointments%ROWTYPE;
  v_id uuid;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_res jsonb;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  FOREACH v_id IN ARRAY COALESCE(p_appointment_ids, '{}'::uuid[]) LOOP
    SELECT * INTO v_appt FROM public.pt_appointments WHERE id = v_id;
    CONTINUE WHEN NOT FOUND;

    IF v_appt.user_id <> v_pass.user_id THEN
      RAISE EXCEPTION 'Appointment % belongs to a different client', v_id;
    END IF;
    IF v_appt.status <> 'completed' THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.pt_session_usage u
                WHERE u.appointment_id = v_id AND u.quantity < 0 AND u.reversed_at IS NULL) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    v_res := public.pt_apply_session_delta(
      p_pass_id => p_pass_id,
      p_delta => -1,
      p_event_type => 'historical_session_applied',
      p_reason => COALESCE(NULLIF(btrim(p_reason),''),'Historical session reconciliation'),
      p_appointment_id => v_id,
      p_idempotency_key => 'appt_apply:' || v_id::text,
      p_actor => auth.uid(),
      p_used_at => v_appt.starts_at
    );

    IF COALESCE((v_res->>'duplicate')::boolean, false) THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_applied := v_applied + 1;
      UPDATE public.pt_appointments
         SET pass_id = p_pass_id,
             usage_id = COALESCE((v_res->>'usage_id')::uuid, usage_id),
             package_deducted = true,
             package_deducted_at = COALESCE(package_deducted_at, now()),
             payment_status = CASE WHEN payment_status IN ('unpaid') THEN 'pass' ELSE payment_status END,
             updated_at = now()
       WHERE id = v_id;
    END IF;
  END LOOP;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id;
  RETURN jsonb_build_object('success', true, 'applied', v_applied, 'skipped', v_skipped,
                            'sessions_remaining', v_pass.sessions_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.pt_apply_past_appointments(uuid,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_apply_past_appointments(uuid,uuid[],text) TO authenticated, service_role;

-- ---------- 10. Historical session with no appointment ----------
CREATE OR REPLACE FUNCTION public.pt_record_historical_session(
  p_pass_id uuid,
  p_session_date date,
  p_quantity integer,
  p_reason text,
  p_instructor_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res jsonb;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')),'') = '' THEN
    RAISE EXCEPTION 'A reason or source is required';
  END IF;
  IF COALESCE(p_quantity,0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  v_res := public.pt_apply_session_delta(
    p_pass_id => p_pass_id,
    p_delta => -p_quantity,
    p_event_type => 'historical_session_no_appointment',
    p_reason => btrim(p_reason) || COALESCE(' — ' || NULLIF(btrim(COALESCE(p_note,'')),''), ''),
    p_idempotency_key => COALESCE(p_idempotency_key, 'hist_session:' || p_pass_id::text || ':' || p_session_date::text || ':' || md5(p_reason)),
    p_actor => auth.uid(),
    p_used_at => (p_session_date::timestamp AT TIME ZONE 'America/Detroit')
  );
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.pt_record_historical_session(uuid,date,integer,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_record_historical_session(uuid,date,integer,text,uuid,text,text) TO authenticated, service_role;

-- ---------- 11. Settlement: apply package to a completed unpaid session ----------
CREATE OR REPLACE FUNCTION public.pt_settle_with_package(
  p_appointment_ids uuid[],
  p_pass_id uuid,
  p_reason text DEFAULT 'Settled with package session'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res jsonb;
BEGIN
  v_res := public.pt_apply_past_appointments(p_pass_id, p_appointment_ids, p_reason);
  UPDATE public.pt_appointments
     SET payment_status = 'pass', payment_method = 'package', paid_at = COALESCE(paid_at, now()), updated_at = now()
   WHERE id = ANY(p_appointment_ids)
     AND package_deducted = true;
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.pt_settle_with_package(uuid[],uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_settle_with_package(uuid[],uuid,text) TO authenticated, service_role;

-- ---------- 12. Settlement: money (manual / card) with per-appointment allocation ----------
CREATE OR REPLACE FUNCTION public.pt_record_session_payment(
  p_appointment_ids uuid[],
  p_method text,
  p_amount_cents integer DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_payment public.pt_payments%ROWTYPE;
  v_user uuid;
  v_total integer := 0;
  v_appt public.pt_appointments%ROWTYPE;
  v_id uuid;
  v_alloc integer;
  v_remaining integer;
  v_count integer := 0;
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
    SELECT * INTO v_appt FROM public.pt_appointments WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF v_user IS NULL THEN v_user := v_appt.user_id;
    ELSIF v_user <> v_appt.user_id THEN RAISE EXCEPTION 'All sessions must belong to one client'; END IF;
    v_total := v_total + COALESCE(v_appt.amount_due_cents, 0);
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.pt_payments (
    user_id, amount_cents, method, status, stripe_payment_intent_id,
    reference, note, paid_at, recorded_by, idempotency_key
  ) VALUES (
    v_user, COALESCE(p_amount_cents, v_total), p_method, 'succeeded', p_stripe_payment_intent_id,
    p_reference, p_note, COALESCE(p_paid_at, now()), auth.uid(), p_idempotency_key
  ) RETURNING * INTO v_payment;

  -- Allocate back to each appointment; rounding lands on the final session.
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
$$;
REVOKE ALL ON FUNCTION public.pt_record_session_payment(uuid[],text,integer,timestamptz,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_record_session_payment(uuid[],text,integer,timestamptz,text,text,text,text) TO authenticated, service_role;

-- ---------- 13. Settlement: comp / waive ----------
CREATE OR REPLACE FUNCTION public.pt_waive_sessions(
  p_appointment_ids uuid[],
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN
    RAISE EXCEPTION 'PT_WAIVE_NOT_AUTHORIZED: only a manager or admin can waive a session charge';
  END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')),'') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.pt_appointments
     SET payment_status = 'comp',
         payment_method = 'complimentary',
         paid_at = COALESCE(paid_at, now()),
         payment_note = btrim(p_reason),
         updated_at = now()
   WHERE id = ANY(p_appointment_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'waived', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.pt_waive_sessions(uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_waive_sessions(uuid[],text) TO authenticated, service_role;

-- ---------- 14. Payment plan linkage ----------
CREATE OR REPLACE FUNCTION public.pt_link_payment_plan(
  p_pass_ids uuid[],
  p_subscription_id text,
  p_total_installments integer,
  p_installments_paid integer,
  p_installment_cents integer,
  p_total_cents integer,
  p_next_payment_date date DEFAULT NULL,
  p_status text DEFAULT 'active'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN
    RAISE EXCEPTION 'PT_PLAN_NOT_AUTHORIZED: only a manager or admin can set up a payment plan';
  END IF;

  UPDATE public.pt_passes SET
    stripe_subscription_id = p_subscription_id,
    payment_plan_subscription_id = p_subscription_id,
    payment_plan_total_installments = p_total_installments,
    payment_plan_installments_paid = p_installments_paid,
    payment_plan_installment_cents = p_installment_cents,
    payment_plan_total_cents = p_total_cents,
    payment_plan_next_payment_date = p_next_payment_date,
    payment_plan_status = p_status,
    financial_status = 'payment_plan',
    amount_paid_cents = COALESCE(p_installment_cents,0) * GREATEST(COALESCE(p_installments_paid,0),0),
    amount_outstanding_cents = GREATEST(0, COALESCE(p_total_cents,0) - COALESCE(p_installment_cents,0) * GREATEST(COALESCE(p_installments_paid,0),0)),
    updated_at = now()
  WHERE id = ANY(p_pass_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.pt_link_payment_plan(uuid[],text,integer,integer,integer,integer,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_link_payment_plan(uuid[],text,integer,integer,integer,integer,date,text) TO authenticated, service_role;

-- ---------- 15. Unified package history ----------
CREATE OR REPLACE FUNCTION public.pt_pass_history(p_pass_id uuid)
RETURNS TABLE (
  occurred_at timestamptz, source text, event_type text, delta integer,
  sessions_before integer, sessions_after integer, reason text,
  appointment_id uuid, related_pass_id uuid, actor uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT u.used_at, 'usage', u.event_type, u.quantity, u.sessions_before, u.sessions_after,
         u.reason, u.appointment_id, NULL::uuid, COALESCE(u.created_by, u.used_by_admin_id)
    FROM public.pt_session_usage u
   WHERE u.pass_id = p_pass_id AND public.pt_is_staff_or_desk(auth.uid())
  UNION ALL
  SELECT a.created_at, 'adjustment', a.adjustment_type, a.delta_sessions, a.sessions_before,
         a.sessions_after, a.reason, NULL::uuid, a.transfer_pass_id, a.created_by
    FROM public.pt_pass_adjustments a
   WHERE a.pass_id = p_pass_id AND public.pt_is_staff_or_desk(auth.uid())
   ORDER BY 1 DESC;
$$;
REVOKE ALL ON FUNCTION public.pt_pass_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_pass_history(uuid) TO authenticated, service_role;