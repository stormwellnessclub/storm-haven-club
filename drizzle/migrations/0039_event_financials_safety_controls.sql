-- 1. Test-event flag ------------------------------------------------------
ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2. Payment idempotency: a Stripe payment intent can only ever be recorded once
DELETE FROM public.event_payments a
USING public.event_payments b
WHERE a.stripe_payment_intent_id IS NOT NULL
  AND a.stripe_payment_intent_id = b.stripe_payment_intent_id
  AND a.direction = b.direction
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS event_payments_intent_uniq
  ON public.event_payments (stripe_payment_intent_id, direction)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 3. Placeholder agreement protection ------------------------------------
ALTER TABLE public.event_documents ADD COLUMN IF NOT EXISTS terms_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_documents ADD COLUMN IF NOT EXISTS terms_approved_by uuid;
ALTER TABLE public.event_documents ADD COLUMN IF NOT EXISTS terms_approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_placeholder_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind <> 'contract' THEN RETURN NEW; END IF;

  -- Any agreement still carrying placeholder language can never be approved.
  IF COALESCE(NEW.terms_body, '') ILIKE '%[PLACEHOLDER%' THEN
    NEW.terms_approved := false;
    NEW.terms_approved_by := NULL;
    NEW.terms_approved_at := NULL;
  END IF;

  IF NEW.status IN ('sent','viewed','accepted','signed') AND NOT NEW.terms_approved THEN
    RAISE EXCEPTION 'This agreement still uses placeholder terms. An attorney-approved template is required before it can be sent or signed.';
  END IF;

  IF NEW.terms_approved AND (TG_OP = 'INSERT' OR COALESCE(OLD.terms_approved, false) = false) THEN
    NEW.terms_approved_by := COALESCE(NEW.terms_approved_by, auth.uid());
    NEW.terms_approved_at := COALESCE(NEW.terms_approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_placeholder_contracts ON public.event_documents;
CREATE TRIGGER trg_guard_placeholder_contracts
BEFORE INSERT OR UPDATE ON public.event_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_placeholder_contracts();

-- 4. Legacy import preview (read-only) -----------------------------------
CREATE OR REPLACE FUNCTION public.preview_private_event_financial_import()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_before_invoiced bigint;
  v_before_paid bigint;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'void'), 0),
         COALESCE(SUM(amount_paid_cents), 0)
    INTO v_before_invoiced, v_before_paid
    FROM public.event_invoices;

  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'event_date'), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'private_event_id', pe.id,
      'title', pe.title,
      'event_date', pe.event_date,
      'client_name', NULLIF(TRIM(CONCAT(pe.client_first_name,' ',pe.client_last_name)), ''),
      'client_email', pe.client_email,
      'already_imported', EXISTS (SELECT 1 FROM public.event_financials f WHERE f.private_event_id = pe.id),
      'pricing_mode', CASE WHEN COALESCE(pe.flat_total_cents,0) > 0 THEN 'flat' ELSE 'itemized' END,
      'flat_total_cents', COALESCE(pe.flat_total_cents,0),
      'line_item_count', (SELECT count(*) FROM public.private_event_line_items li WHERE li.event_id = pe.id),
      'line_item_total_cents', (SELECT COALESCE(SUM(li.quantity * li.unit_price_cents),0) FROM public.private_event_line_items li WHERE li.event_id = pe.id),
      'invoice_count', (SELECT count(*) FROM public.private_event_invoices pi WHERE pi.event_id = pe.id),
      'invoice_total_cents', (SELECT COALESCE(SUM(pi.amount_cents),0) FROM public.private_event_invoices pi WHERE pi.event_id = pe.id AND pi.status <> 'void'),
      'paid_total_cents', (SELECT COALESCE(SUM(pi.amount_cents),0) FROM public.private_event_invoices pi WHERE pi.event_id = pe.id AND pi.status = 'paid'),
      'missing', (
        SELECT COALESCE(jsonb_agg(m), '[]'::jsonb) FROM (
          SELECT 'Client email' AS m WHERE pe.client_email IS NULL OR pe.client_email = ''
          UNION ALL SELECT 'Event date' WHERE pe.event_date IS NULL
          UNION ALL SELECT 'Contracted total (no flat price and no quote lines)'
            WHERE COALESCE(pe.flat_total_cents,0) = 0
              AND NOT EXISTS (SELECT 1 FROM public.private_event_line_items li WHERE li.event_id = pe.id)
        ) x
      ),
      'needs_manual_review', (
        COALESCE(pe.flat_total_cents,0) = 0
        AND NOT EXISTS (SELECT 1 FROM public.private_event_line_items li WHERE li.event_id = pe.id)
        AND EXISTS (SELECT 1 FROM public.private_event_invoices pi WHERE pi.event_id = pe.id)
      )
    ) AS r
    FROM public.private_events pe
  ) s;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'records', v_rows,
    'totals_before', jsonb_build_object('invoiced_cents', v_before_invoiced, 'paid_cents', v_before_paid),
    'field_mapping', jsonb_build_array(
      jsonb_build_object('from','private_events.title','to','event_financials.title'),
      jsonb_build_object('from','private_events.client_first_name + client_last_name','to','event_financials.client_name'),
      jsonb_build_object('from','private_events.client_email / client_phone','to','event_financials.client_email / client_phone'),
      jsonb_build_object('from','private_events.flat_total_cents','to','event_financials.package_price_cents (pricing mode: flat)'),
      jsonb_build_object('from','private_events.tax_enabled / pass_processing_fee','to','event_financials.tax_enabled / pass_processing_fee'),
      jsonb_build_object('from','private_event_line_items','to','event_financial_items (included when a flat price exists, otherwise priced)'),
      jsonb_build_object('from','private_event_invoices','to','event_invoices (legacy_invoice_id retained)'),
      jsonb_build_object('from','private_event_invoices where status = paid','to','event_payments (payment ledger entry)')
    )
  );
END;
$$;

-- 5. Documented rollback for an imported workspace ------------------------
CREATE OR REPLACE FUNCTION public.rollback_private_event_financial_import(p_financial_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_fin public.event_financials%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO v_fin FROM public.event_financials WHERE id = p_financial_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial workspace not found'; END IF;
  IF v_fin.legacy_source IS DISTINCT FROM 'private_events' THEN
    RAISE EXCEPTION 'Only imported workspaces can be rolled back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.event_payments p
    WHERE p.financial_id = p_financial_id AND p.stripe_payment_intent_id IS NOT NULL
      AND p.notes IS DISTINCT FROM 'Imported from legacy private event invoice'
  ) THEN
    RAISE EXCEPTION 'This workspace has taken new payments since import and cannot be rolled back automatically';
  END IF;

  DELETE FROM public.event_financials WHERE id = p_financial_id;
  -- the original private_events / private_event_invoices records are untouched
END;
$$;

-- 6. Event times must be coherent ----------------------------------------
CREATE OR REPLACE FUNCTION public.validate_private_event_times()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'The end time must be later than the start time.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_private_event_times ON public.private_events;
CREATE TRIGGER trg_validate_private_event_times
BEFORE INSERT OR UPDATE ON public.private_events
FOR EACH ROW EXECUTE FUNCTION public.validate_private_event_times();